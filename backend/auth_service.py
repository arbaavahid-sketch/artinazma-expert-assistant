"""
JWT Authentication Service
"""

import logging
import os
import secrets
from typing import Optional
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Request, HTTPException, Depends, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

logger = logging.getLogger("auth_service")

_JWT_SECRET = os.getenv("JWT_SECRET", "").strip()
if not _JWT_SECRET:
    _JWT_SECRET = secrets.token_urlsafe(48)
    logger.warning("[auth] WARNING: JWT_SECRET not set -- using random key (tokens won't survive restarts)")

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "72"))

JWT_COOKIE_NAME = "artin_jwt"


def _cookie_secure() -> bool:
    """Send auth cookies only over HTTPS in production.

    Override with COOKIE_SECURE=true/false; otherwise defaults to secure
    when ENVIRONMENT=production (the app runs behind HTTPS via nginx in prod).
    """
    override = os.getenv("COOKIE_SECURE", "").strip().lower()
    if override in ("1", "true", "yes"):
        return True
    if override in ("0", "false", "no"):
        return False
    return os.getenv("ENVIRONMENT", "production").strip().lower() == "production"

_bearer_scheme = HTTPBearer(auto_error=False)


def set_jwt_cookie(response: Response, token: str) -> None:
    """Set the JWT as an httpOnly, SameSite=Lax cookie on the response."""
    response.set_cookie(
        key=JWT_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_HOURS * 3600,
        path="/",
    )


def clear_jwt_cookie(response: Response) -> None:
    """Delete the JWT cookie (logout)."""
    response.delete_cookie(key=JWT_COOKIE_NAME, path="/")


def create_access_token(customer_id: int, email: str) -> str:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    payload = {
        "sub": str(customer_id),
        "email": email,
        "iat": now,
        "exp": now + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS),
        "type": "access",
    }
    return jwt.encode(payload, _JWT_SECRET, algorithm=JWT_ALGORITHM)


def verify_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, _JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def _extract_token(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
) -> Optional[str]:
    cookie_token = request.cookies.get(JWT_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if credentials and credentials.credentials:
        return credentials.credentials
    return None


async def get_current_customer(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    token = _extract_token(request, credentials)
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = verify_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "customer_id": int(payload["sub"]),
        "email": payload.get("email", ""),
    }


async def get_optional_customer(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> Optional[dict]:
    token = _extract_token(request, credentials)
    if not token:
        return None

    payload = verify_access_token(token)
    if not payload:
        return None

    return {
        "customer_id": int(payload["sub"]),
        "email": payload.get("email", ""),
    }


def require_customer_match(token_customer_id: int, path_customer_id: int):
    if token_customer_id != path_customer_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied.",
        )
