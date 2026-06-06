import secrets
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

from repositories.base import get_connection, DBIntegrityError


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), stored_hash.encode("utf-8"))
    except Exception:
        return False


def create_customer(
    full_name: str, email: str, password: str, company: str = "", phone: str = ""
) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO customers
            (full_name, email, password_hash, company, phone, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                full_name,
                email.lower().strip(),
                hash_password(password),
                company,
                phone,
                datetime.now().isoformat(timespec="seconds"),
            ),
        )

        customer_id = cursor.lastrowid
        conn.commit()

        return {"success": True, "customer_id": customer_id}

    except DBIntegrityError:
        return {"success": False, "message": "این ایمیل قبلاً ثبت شده است."}

    finally:
        conn.close()


def authenticate_customer(email: str, password: str) -> Dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, full_name, email, password_hash, company, phone, created_at, is_blocked
        FROM customers
        WHERE email = ?
        """,
        (email.lower().strip(),),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    if not verify_password(password, row["password_hash"]):
        return None

    if row["is_blocked"]:
        return {"blocked": True}

    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "company": row["company"] or "",
        "phone": row["phone"] or "",
        "created_at": row["created_at"],
    }


def get_customer_by_id(customer_id: int) -> Dict[str, Any] | None:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, full_name, email, company, phone, created_at
        FROM customers
        WHERE id = ?
        """,
        (customer_id,),
    )

    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "company": row["company"] or "",
        "phone": row["phone"] or "",
        "created_at": row["created_at"],
    }


def get_all_customers(limit: int = 200, offset: int = 0) -> List[Dict[str, Any]]:
    """لیست همه مشتریان به همراه آمار جلسات و پیام‌ها."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            c.id,
            c.full_name,
            c.email,
            c.company,
            c.phone,
            c.created_at,
            c.is_blocked,
            COUNT(DISTINCT cs.id) AS session_count,
            COUNT(cm.id) AS message_count,
            MAX(cm.created_at) AS last_active,
            (
                SELECT cm2.content
                FROM chat_messages cm2
                INNER JOIN chat_sessions cs2 ON cm2.session_id = cs2.id
                WHERE cs2.customer_id = c.id
                ORDER BY cm2.id DESC
                LIMIT 1
            ) AS last_message
        FROM customers c
        LEFT JOIN chat_sessions cs ON cs.customer_id = c.id
        LEFT JOIN chat_messages cm ON cm.session_id = cs.id
        GROUP BY c.id
        ORDER BY c.created_at DESC
        LIMIT ? OFFSET ?
        """,
        (limit, offset),
    )
    rows = cursor.fetchall()
    total = cursor.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    conn.close()
    return {
        "total": total,
        "customers": [
            {
                "id": r["id"],
                "full_name": r["full_name"],
                "email": r["email"],
                "company": r["company"] or "",
                "phone": r["phone"] or "",
                "created_at": r["created_at"],
                "session_count": r["session_count"],
                "message_count": r["message_count"],
                "last_active": r["last_active"] or None,
                "is_blocked": bool(r["is_blocked"]) if "is_blocked" in r.keys() else False,
                "last_message_preview": (r["last_message"][:100] + "…" if r["last_message"] and len(r["last_message"]) > 100 else r["last_message"]) if r["last_message"] else None,
            }
            for r in rows
        ],
    }


def get_customer_sessions(customer_id: int) -> List[Dict[str, Any]]:
    """لیست جلسات چت یک مشتری با آمار پیام‌ها."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            cs.id,
            cs.title,
            cs.created_at,
            COUNT(cm.id) AS message_count,
            MAX(cm.created_at) AS last_message_at,
            (
                SELECT cm2.content
                FROM chat_messages cm2
                WHERE cm2.session_id = cs.id AND cm2.role = 'user'
                ORDER BY cm2.id ASC
                LIMIT 1
            ) AS first_user_message
        FROM chat_sessions cs
        LEFT JOIN chat_messages cm ON cm.session_id = cs.id
        WHERE cs.customer_id = ?
        GROUP BY cs.id
        ORDER BY cs.created_at DESC
        """,
        (customer_id,),
    )
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "title": r["title"] or "",
            "created_at": r["created_at"],
            "message_count": r["message_count"],
            "last_message_at": r["last_message_at"] or None,
            "first_user_message": (r["first_user_message"][:120] + "…" if r["first_user_message"] and len(r["first_user_message"]) > 120 else r["first_user_message"]) if r["first_user_message"] else None,
        }
        for r in rows
    ]


def set_customer_blocked(customer_id: int, blocked: bool) -> bool:
    """بلاک یا فعال‌سازی حساب مشتری."""
    conn = get_connection()
    try:
        cur = conn.execute(
            "UPDATE customers SET is_blocked = ? WHERE id = ?",
            (1 if blocked else 0, customer_id),
        )
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def update_customer_profile(
    customer_id: int, full_name: str, company: str = "", phone: str = ""
) -> Dict[str, Any] | None:
    if not full_name.strip():
        return None

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE customers
        SET full_name = ?,
            company = ?,
            phone = ?
        WHERE id = ?
        """,
        (full_name.strip(), company.strip(), phone.strip(), customer_id),
    )

    updated = cursor.rowcount > 0

    conn.commit()
    conn.close()

    if not updated:
        return None

    return get_customer_by_id(customer_id)


def change_customer_password(customer_id: int, current_password: str, new_password: str) -> dict:
    """تغییر رمز عبور مشتری پس از تایید رمز فعلی"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT password_hash FROM customers WHERE id=?", (customer_id,))
        row = cursor.fetchone()
        if not row:
            return {"success": False, "message": "مشتری پیدا نشد."}
        if not verify_password(current_password, row[0]):
            return {"success": False, "message": "رمز عبور فعلی اشتباه است."}
        new_hash = hash_password(new_password)
        cursor.execute("UPDATE customers SET password_hash=? WHERE id=?", (new_hash, customer_id))
        conn.commit()
        return {"success": True, "message": "رمز عبور با موفقیت تغییر یافت."}
    finally:
        conn.close()


def create_password_reset_token(customer_id: int) -> str:
    """ساخت توکن بازیابی رمز عبور (معتبر ۱ ساعت)."""
    conn = get_connection()
    try:
        # Invalidate old tokens
        conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE customer_id = ? AND used = 0", (customer_id,))

        token = secrets.token_urlsafe(48)
        expires_at = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=1)).isoformat()

        conn.execute(
            "INSERT INTO password_reset_tokens (customer_id, token, expires_at) VALUES (?, ?, ?)",
            (customer_id, token, expires_at),
        )
        conn.commit()
        return token
    finally:
        conn.close()


def verify_reset_token(token: str) -> dict | None:
    """بررسی اعتبار توکن. اگر معتبر باشد dict با customer_id برمیگرداند."""
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT id, customer_id, expires_at, used FROM password_reset_tokens WHERE token = ?",
            (token,),
        ).fetchone()

        if not row:
            return None
        if row["used"]:
            return None
        if datetime.now(timezone.utc).replace(tzinfo=None).isoformat() > row["expires_at"]:
            return None

        return {"token_id": row["id"], "customer_id": row["customer_id"]}
    finally:
        conn.close()


def reset_password_with_token(token: str, new_password: str) -> dict:
    """بازنشانی رمز عبور با استفاده از توکن معتبر."""
    check = verify_reset_token(token)
    if not check:
        return {"success": False, "message": "توکن نامعتبر یا منقضی شده است."}

    conn = get_connection()
    try:
        hashed = bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        conn.execute("UPDATE customers SET password_hash = ? WHERE id = ?", (hashed, check["customer_id"]))
        conn.execute("UPDATE password_reset_tokens SET used = 1 WHERE id = ?", (check["token_id"],))
        conn.commit()
        return {"success": True, "message": "رمز عبور با موفقیت تغییر کرد."}
    finally:
        conn.close()
