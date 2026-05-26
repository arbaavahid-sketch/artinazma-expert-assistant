"""
سرویس احراز هویت مشتریان با JWT
──────────────────────────────────
هر مشتری بعد از login یک access_token دریافت می‌کند.
اندپوینت‌های محافظت‌شده با require_customer توکن را بررسی می‌کنند.
"""

import os
import time
import secrets
from typing import Optional
from datetime import datetime, timedelta

import jwt
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ─── Configuration ──────────────────────────────────────────────────────────
# کلید امضای JWT — اگر متغیر محیطی نباشد، یک کلید تصادفی تولید و ذخیره می‌شود
_JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
if not _JWT_SECRET:
    _JWT_SECRET = secrets.token_urlsafe(48)
    # در محیط توسعه OK است ولی در پروداکشن باید ست شود
    print("[auth] ⚠️  JWT_SECRET not set — using random key (tokens won't survive restarts)")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "72"))  # 3 days default

_bearer_scheme = HTTPBearer(auto_error=False)


# ─── Token Creation ────────────────────────────────────────────────────────

def create_access_token(customer_id: int, email: str) -> str:
    """ساخت JWT access token برای مشتری."""
    now = datetime.utcnow()
    payload = {
        "sub": str(customer_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm=JWT_ALGORITHM)


# ─── Token Verification ────────────────────────────────────────────────────

def verify_access_token(token: str) -> Optional[dict]:
    """
    بررسی و decode توکن JWT.
    در صورت موفقیت payload برمی‌گرداند، در غیر اینصورت None.
    """
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# ─── FastAPI Dependency ─────────────────────────────────────────────────────

async def get_current_customer(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """
    FastAPI dependency — توکن Bearer را از هدر Authorization می‌خواند.
    در صورت نامعتبر بودن، 401 برمی‌گرداند.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="لطفاً وارد حساب کاربری خود شوید.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="توکن نامعتبر یا منقضی شده است. لطفاً دوباره وارد شوید.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "customer_id": int(payload["sub"]),
        "email": payload.get("email", ""),
    }


async def get_optional_customer(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[dict]:
    """
    مشابه get_current_customer ولی اختیاری — اگر توکن نباشد None برمی‌گرداند.
    برای اندپوینت‌هایی که هم با login و هم بدون login کار می‌کنند.
    """
    if not credentials or not credentials.credentials:
        return None

    payload = verify_access_token(credentials.credentials)
    if not payload:
        return None

    return {
        "customer_id": int(payload["sub"]),
        "email": payload.get("email", ""),
    }


def require_customer_match(token_customer_id: int, path_customer_id: int):
    """
    بررسی اینکه customer_id در توکن با customer_id در URL یکی باشد.
    جلوگیری از دسترسی مشتری A به اطلاعات مشتری B.
    """
    if token_customer_id != path_customer_id:
        raise HTTPException(
            status_code=403,
            detail="شما اجازه دسترسی به اطلاعات این حساب را ندارید.",
        )
