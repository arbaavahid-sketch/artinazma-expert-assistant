import json
from datetime import datetime
from typing import Any, Dict, List

from repositories.base import get_connection


def save_customer_notification(customer_id: int, message: str, sender: str = "admin") -> int:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO customer_notifications (customer_id, message, sender, is_read, created_at) VALUES (?, ?, ?, 0, ?)",
            (customer_id, message, sender, datetime.utcnow().isoformat()),
        )
        conn.commit()
        return cursor.lastrowid
    finally:
        conn.close()


def get_customer_notifications(customer_id: int, unread_only: bool = False) -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        query = "SELECT * FROM customer_notifications WHERE customer_id = ?"
        params: List[Any] = [customer_id]
        if unread_only:
            query += " AND is_read = 0"
        query += " ORDER BY id DESC LIMIT 50"
        rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def mark_notifications_read(customer_id: int) -> None:
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE customer_notifications SET is_read = 1 WHERE customer_id = ?",
            (customer_id,),
        )
        conn.commit()
    finally:
        conn.close()


def get_unread_notification_count(customer_id: int) -> int:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS cnt FROM customer_notifications WHERE customer_id = ? AND is_read = 0",
            (customer_id,),
        ).fetchone()
        return row["cnt"] if row else 0
    finally:
        conn.close()


def save_push_subscription(customer_id: int, subscription: dict) -> int:
    """ذخیره اشتراک Push Notification مشتری."""
    conn = get_connection()
    try:
        endpoint = subscription.get("endpoint", "")
        keys_json = json.dumps(subscription.get("keys", {}))
        # Upsert: update if endpoint exists
        existing = conn.execute(
            "SELECT id FROM push_subscriptions WHERE endpoint = ?", (endpoint,)
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE push_subscriptions SET customer_id = ?, keys_json = ? WHERE endpoint = ?",
                (customer_id, keys_json, endpoint),
            )
            conn.commit()
            return existing["id"]
        else:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO push_subscriptions (customer_id, endpoint, keys_json) VALUES (?, ?, ?)",
                (customer_id, endpoint, keys_json),
            )
            conn.commit()
            return cursor.lastrowid
    finally:
        conn.close()


def remove_push_subscription(customer_id: int) -> bool:
    """حذف اشتراک Push مشتری."""
    conn = get_connection()
    try:
        conn.execute("DELETE FROM push_subscriptions WHERE customer_id = ?", (customer_id,))
        conn.commit()
        return True
    finally:
        conn.close()


def get_push_subscriptions(customer_id: int) -> list:
    """دریافت لیست اشتراک‌های Push یک مشتری."""
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT endpoint, keys_json FROM push_subscriptions WHERE customer_id = ?",
            (customer_id,),
        ).fetchall()
        result = []
        for r in rows:
            result.append({
                "endpoint": r["endpoint"],
                "keys": json.loads(r["keys_json"]),
            })
        return result
    finally:
        conn.close()
