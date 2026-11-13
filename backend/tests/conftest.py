"""
فیکسچرهای مشترک pytest برای تست‌های بک‌اند آرتین آزما.
"""

import os
import sys
import tempfile
import pytest

# اضافه کردن مسیر بک‌اند به sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# تنظیم متغیرهای محیطی تست قبل از ایمپورت ماژول‌ها
os.environ["TESTING"] = "1"  # غیرفعال‌سازی CSRF و rate limit در تست
os.environ.setdefault("OPENAI_API_KEY", "test_offline_mode")
os.environ.setdefault("ADMIN_API_KEY", "test-admin-key-12345")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-testing-only")
os.environ["QDRANT_URL"] = ""
os.environ["QDRANT_API_KEY"] = ""

# Keep tests away from the developer's real data: never a configured Postgres,
# and the SQLite database and log file live in a throwaway folder for this run.
# Connections are opened from repositories.base.DB_PATH, so that is the one to
# redirect (db_service.DB_PATH is kept in step for code that still reads it).
_TEST_STORAGE = tempfile.mkdtemp(prefix="artin-tests-")
os.environ["DATABASE_URL"] = ""
os.environ["LOG_FILE"] = os.path.join(_TEST_STORAGE, "app.log")

from pathlib import Path  # noqa: E402

import repositories.base as _db_base  # noqa: E402
import db_service as _db_service  # noqa: E402

_TEST_DB_PATH = Path(_TEST_STORAGE) / "app.db"
_db_base.DB_PATH = _TEST_DB_PATH
_db_service.DB_PATH = _TEST_DB_PATH


def _use_test_db():
    _db_base.DB_PATH = _TEST_DB_PATH
    _db_service.DB_PATH = _TEST_DB_PATH


@pytest.fixture(scope="session", autouse=True)
def test_db():
    """دیتابیس موقت برای تست‌ها."""
    _use_test_db()
    _db_service.init_db()
    yield _TEST_DB_PATH


def pytest_sessionfinish(session, exitstatus):
    import logging
    import shutil

    for handler in logging.getLogger().handlers[:]:
        if isinstance(handler, logging.FileHandler):
            handler.close()
            logging.getLogger().removeHandler(handler)
    shutil.rmtree(_TEST_STORAGE, ignore_errors=True)


@pytest.fixture
def app_client(test_db):
    """TestClient برای FastAPI."""
    _use_test_db()
    _db_service.init_db()

    from main import app
    from fastapi.testclient import TestClient
    client = TestClient(app)
    yield client


@pytest.fixture
def admin_headers():
    """هدرهای ادمین برای تست."""
    return {"X-Admin-Key": os.environ["ADMIN_API_KEY"]}


@pytest.fixture
def authenticated_client(app_client):
    """Approved test customer, using the actual login and JWT validation path."""
    from uuid import uuid4
    db_service = _db_service
    email = f"release-{uuid4().hex}@example.invalid"
    password = "Synthetic-release-test-password"
    result = db_service.create_customer("Release test", email, password)
    assert result["success"]
    assert db_service.set_customer_approval_status(result["customer_id"], "approved")
    # Isolate this login from earlier tests sharing the in-memory IP limiter.
    from utils.deps import limiter
    limiter.reset()
    response = app_client.post("/customers/login", json={"email": email, "password": password})
    assert response.status_code == 200 and response.json()["success"]
    try:
        yield app_client
    finally:
        app_client.cookies.clear()
