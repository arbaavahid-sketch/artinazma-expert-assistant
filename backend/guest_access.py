"""Persistent guest allowance. Browser storage and contact forms grant no access.

An anonymous browser is identified by an opaque, httpOnly cookie. Clearing all
cookies creates a new visitor; this is a trial allowance, not person verification.
"""
import hashlib
import secrets

from fastapi import Depends, HTTPException, Request, Response

from auth_service import get_optional_customer, _cookie_secure
from repositories.base import get_connection
from schemas.models import ChatRequest

GUEST_LIMIT = 4
COOKIE_NAME = "artin_guest"


def _key(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _connection():
    conn = get_connection()
    conn.execute("""CREATE TABLE IF NOT EXISTS guest_allowances (
        visitor_key TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0
    )""")
    conn.commit()
    return conn


def guest_access(request: Request, response: Response, customer=None):
    if customer:
        return {"customer_id": customer["customer_id"], "limit": GUEST_LIMIT, "used": 0}
    token = request.cookies.get(COOKIE_NAME, "")
    with _connection() as conn:
        row = conn.execute(
            "SELECT used FROM guest_allowances WHERE visitor_key = ?", (_key(token),)
        ).fetchone() if token else None
        if row is None:
            token = secrets.token_urlsafe(32)
            conn.execute("INSERT INTO guest_allowances (visitor_key, used) VALUES (?, 0)", (_key(token),))
            used = 0
        else:
            used = row["used"]
    response.set_cookie(COOKIE_NAME, token, httponly=True, secure=_cookie_secure(),
                        samesite="lax", max_age=365 * 24 * 3600, path="/")
    response.headers["Cache-Control"] = "no-store"
    return {"customer_id": None, "limit": GUEST_LIMIT, "used": used}


def authorize_chat(body: ChatRequest, request: Request,
                   customer=Depends(get_optional_customer)):
    if customer:
        body.customer_id = customer["customer_id"]
        body.user_id = f"customer_{body.customer_id}"
        return body
    # Never trust account IDs or memory identities supplied by an anonymous caller.
    body.customer_id = None
    body.context = None
    body.domain = "auto"
    body.response_mode = "auto"
    token = request.cookies.get(COOKIE_NAME, "")
    if not token:
        raise HTTPException(401, detail="guest_session_required")
    key = _key(token)
    with _connection() as conn:
        changed = conn.execute(
            "UPDATE guest_allowances SET used = used + 1 WHERE visitor_key = ? AND used < ?",
            (key, GUEST_LIMIT),
        ).rowcount
    if changed != 1:
        raise HTTPException(403, detail="registration_required")
    body.user_id = f"guest_{key}"
    return body
