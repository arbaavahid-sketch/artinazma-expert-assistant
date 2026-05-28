"""
Security middleware: CSRF tokens, smart rate limiting, brute-force protection.
"""

import os
import secrets
import time
import hashlib
import logging
from collections import defaultdict
from typing import Optional
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# ── CSRF Protection ────────────────────────────────────────────────────────────

_CSRF_SECRET = os.getenv("CSRF_SECRET", secrets.token_hex(32))
_CSRF_HEADER = "X-CSRF-Token"
_CSRF_COOKIE = "artin_csrf"
_CSRF_EXEMPT_PATHS = {
    "/chat", "/chat-stream", "/ws/chat",
    "/customers/login", "/customers/register", "/customers/logout",
    "/customer-requests",
    "/analyze-image", "/analyze-file", "/transcribe",
}
_CSRF_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def generate_csrf_token(session_id: str = "") -> str:
    """Generate a CSRF token tied to a session identifier."""
    raw = f"{_CSRF_SECRET}:{session_id}:{secrets.token_hex(16)}"
    return hashlib.sha256(raw.encode()).hexdigest()[:48]


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection for state-changing requests.
    Sets a CSRF cookie on every response and validates it on POST/PUT/PATCH/DELETE.
    Exempt: public chat API, WebSocket, and GET/HEAD/OPTIONS.
    """

    async def dispatch(self, request: Request, call_next):
        # Skip CSRF in test mode (set TESTING=1 in environment)
        if os.getenv("TESTING") == "1":
            return await call_next(request)

        # Skip non-state-changing methods
        if request.method not in _CSRF_METHODS:
            response = await call_next(request)
            # Set CSRF cookie if not present
            if not request.cookies.get(_CSRF_COOKIE):
                token = generate_csrf_token()
                response.set_cookie(
                    _CSRF_COOKIE, token,
                    httponly=False,  # JS needs to read it
                    samesite="lax",
                    max_age=86400,
                )
            return response

        path = request.url.path

        # Skip exempt paths
        if any(path.startswith(p) for p in _CSRF_EXEMPT_PATHS):
            return await call_next(request)

        # Skip API key protected admin endpoints (already authed)
        if "x-admin-key" in request.headers:
            return await call_next(request)

        # Skip JWT-protected endpoints (token is sufficient auth)
        auth_header = request.headers.get("authorization", "")
        if auth_header.startswith("Bearer "):
            return await call_next(request)

        # For other POST requests, validate CSRF
        cookie_token = request.cookies.get(_CSRF_COOKIE, "")
        header_token = request.headers.get(_CSRF_HEADER, "")

        if not cookie_token or not header_token or cookie_token != header_token:
            logger.warning(f"CSRF validation failed for {path} from {request.client.host}")
            return JSONResponse(
                status_code=403,
                content={"detail": "CSRF token missing or invalid."},
            )

        response = await call_next(request)
        return response


# ── Brute Force Protection ──────────────────────────────────────────────────

class _LoginTracker:
    """Track failed login attempts per IP."""

    def __init__(self, max_attempts: int = 5, lockout_seconds: int = 300):
        self.max_attempts = max_attempts
        self.lockout_seconds = lockout_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)
        self._lockouts: dict[str, float] = {}

    def is_locked(self, ip: str) -> bool:
        lockout_until = self._lockouts.get(ip, 0)
        if time.time() < lockout_until:
            return True
        if lockout_until > 0 and time.time() >= lockout_until:
            # Lockout expired, reset
            del self._lockouts[ip]
            self._attempts.pop(ip, None)
        return False

    def record_failure(self, ip: str):
        now = time.time()
        # Keep only recent attempts (within lockout window)
        self._attempts[ip] = [
            t for t in self._attempts[ip] if now - t < self.lockout_seconds
        ] + [now]
        if len(self._attempts[ip]) >= self.max_attempts:
            self._lockouts[ip] = now + self.lockout_seconds
            logger.warning(f"IP {ip} locked out for {self.lockout_seconds}s after {self.max_attempts} failed login attempts")

    def record_success(self, ip: str):
        self._attempts.pop(ip, None)
        self._lockouts.pop(ip, None)

    def get_remaining_lockout(self, ip: str) -> int:
        """Returns remaining lockout seconds, 0 if not locked."""
        lockout_until = self._lockouts.get(ip, 0)
        remaining = lockout_until - time.time()
        return max(0, int(remaining))


login_tracker = _LoginTracker(max_attempts=5, lockout_seconds=300)


# ── Smart Rate Limiter ────────────────────────────────────────────────────────

class _SmartRateLimiter:
    """
    Progressive rate limiting: normal users get generous limits,
    abusers get progressively restricted.
    """

    def __init__(self):
        # Tracks request counts per IP in sliding windows
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._penalties: dict[str, int] = defaultdict(int)  # penalty level 0-3

    def _clean_old(self, ip: str, window: int = 60):
        now = time.time()
        self._requests[ip] = [t for t in self._requests[ip] if now - t < window]

    def check_rate(self, ip: str, path: str) -> Optional[JSONResponse]:
        """Check if request should be rate-limited. Returns error response or None."""
        self._clean_old(ip)
        self._requests[ip].append(time.time())
        count = len(self._requests[ip])

        penalty = self._penalties[ip]

        # Base limits vary by penalty level
        limits = {
            0: 30,   # normal: 30 req/min
            1: 20,   # warning: 20 req/min
            2: 10,   # restricted: 10 req/min
            3: 3,    # severely restricted: 3 req/min
        }
        limit = limits.get(min(penalty, 3), 3)

        if count > limit:
            # Escalate penalty
            if penalty < 3:
                self._penalties[ip] = penalty + 1
                logger.warning(f"Rate limit escalation for {ip}: level {penalty} -> {penalty + 1}")

            retry_after = 60 if penalty < 2 else 300
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "درخواست‌های شما بیش از حد مجاز است. لطفاً کمی صبر کنید.",
                    "retry_after": retry_after,
                },
                headers={"Retry-After": str(retry_after)},
            )

        # Gradually reduce penalty if behaving well
        if count < limit // 2 and penalty > 0:
            self._penalties[ip] = max(0, penalty - 1)

        return None


smart_limiter = _SmartRateLimiter()


class SmartRateLimitMiddleware(BaseHTTPMiddleware):
    """Apply smart rate limiting to chat endpoints."""

    _RATE_LIMITED_PREFIXES = ["/chat", "/chat-stream"]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if request.method == "POST" and any(path.startswith(p) for p in self._RATE_LIMITED_PREFIXES):
            ip = request.client.host if request.client else "unknown"
            error = smart_limiter.check_rate(ip, path)
            if error:
                return error
        return await call_next(request)
