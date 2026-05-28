import os
from fastapi import HTTPException, Security
from fastapi.security import APIKeyHeader
from slowapi import Limiter
from slowapi.util import get_remote_address

_admin_key_header = APIKeyHeader(name="X-Admin-Key", auto_error=False)

limiter = Limiter(key_func=get_remote_address)


def require_admin(api_key: str = Security(_admin_key_header)):
    expected = os.getenv("ADMIN_API_KEY", "").strip()
    if not expected:
        raise HTTPException(status_code=503, detail="ADMIN_API_KEY تنظیم نشده است.")
    if api_key != expected:
        raise HTTPException(status_code=401, detail="دسترسی غیرمجاز.")
