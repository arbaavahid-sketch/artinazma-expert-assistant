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


@pytest.fixture(scope="session")
def test_db():
    """دیتابیس موقت برای تست‌ها."""
    import db_service
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name

    original_path = db_service.DB_PATH
    db_service.DB_PATH = db_path
    db_service.init_db()

    yield db_path

    db_service.DB_PATH = original_path
    os.unlink(db_path)


@pytest.fixture
def app_client(test_db):
    """TestClient برای FastAPI."""
    import db_service
    db_service.DB_PATH = test_db
    db_service.init_db()

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
    import db_service
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
