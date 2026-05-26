"""
تست‌های پایه API — سلامت سرویس و دسترسی‌های عمومی.
"""

import pytest


class TestHealthAndStatus:
    """تست‌های سلامت سرویس."""

    def test_home(self, app_client):
        res = app_client.get("/")
        assert res.status_code == 200
        data = res.json()
        assert "message" in data
        assert "running" in data["message"].lower()

    def test_health(self, app_client):
        res = app_client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert "ok" in data
        assert "checks" in data
        assert "database" in data["checks"]

    def test_system_status(self, app_client):
        res = app_client.get("/system/status")
        assert res.status_code == 200
        data = res.json()
        assert data["backend_status"] == "running"

    def test_knowledge_stats(self, app_client):
        res = app_client.get("/knowledge/stats")
        assert res.status_code == 200

    def test_questions_stats_public(self, app_client):
        res = app_client.get("/questions/stats-public")
        assert res.status_code == 200
        data = res.json()
        assert "total_questions" in data


class TestAdminAuth:
    """تست‌های دسترسی ادمین."""

    def test_admin_endpoint_without_key(self, app_client):
        res = app_client.get("/questions/recent")
        assert res.status_code == 401

    def test_admin_endpoint_wrong_key(self, app_client):
        res = app_client.get("/questions/recent", headers={"X-Admin-Key": "wrong-key"})
        assert res.status_code == 401

    def test_admin_endpoint_correct_key(self, app_client, admin_headers):
        res = app_client.get("/questions/recent", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "questions" in data

    def test_admin_dashboard_stats(self, app_client, admin_headers):
        res = app_client.get("/admin/dashboard-stats", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "questions" in data
        assert "customers" in data
        assert "requests" in data


class TestCustomerAuth:
    """تست‌های احراز هویت مشتری با JWT."""

    def test_register_customer(self, app_client):
        res = app_client.post("/customers/register", json={
            "full_name": "تست کاربر",
            "email": "test@example.com",
            "password": "test123456",
            "company": "شرکت تست",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["customer"]["email"] == "test@example.com"

    def test_login_customer(self, app_client):
        # First register
        app_client.post("/customers/register", json={
            "full_name": "تست لاگین",
            "email": "login@example.com",
            "password": "login123456",
        })
        # Then login
        res = app_client.post("/customers/login", json={
            "email": "login@example.com",
            "password": "login123456",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "access_token" in data

    def test_login_wrong_password(self, app_client):
        app_client.post("/customers/register", json={
            "full_name": "تست رمز",
            "email": "wrongpass@example.com",
            "password": "correct123",
        })
        res = app_client.post("/customers/login", json={
            "email": "wrongpass@example.com",
            "password": "wrongpassword",
        })
        data = res.json()
        assert data["success"] is False

    def test_profile_without_token(self, app_client):
        """دسترسی به پروفایل بدون توکن باید 401 برگرداند."""
        res = app_client.get("/customers/1")
        assert res.status_code == 401

    def test_profile_with_valid_token(self, app_client):
        """دسترسی به پروفایل با توکن معتبر."""
        reg = app_client.post("/customers/register", json={
            "full_name": "پروفایل تست",
            "email": "profile@example.com",
            "password": "profile123",
        })
        data = reg.json()
        token = data["access_token"]
        customer_id = data["customer"]["id"]

        res = app_client.get(
            f"/customers/{customer_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_profile_access_other_customer(self, app_client):
        """مشتری A نباید بتواند به پروفایل مشتری B دسترسی داشته باشد."""
        reg_a = app_client.post("/customers/register", json={
            "full_name": "مشتری الف",
            "email": "customer_a@example.com",
            "password": "pass123456",
        })
        token_a = reg_a.json()["access_token"]

        reg_b = app_client.post("/customers/register", json={
            "full_name": "مشتری ب",
            "email": "customer_b@example.com",
            "password": "pass123456",
        })
        customer_b_id = reg_b.json()["customer"]["id"]

        # A tries to access B's profile
        res = app_client.get(
            f"/customers/{customer_b_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert res.status_code == 403


class TestInputValidation:
    """تست‌های اعتبارسنجی ورودی."""

    def test_register_short_name(self, app_client):
        res = app_client.post("/customers/register", json={
            "full_name": "ت",
            "email": "short@example.com",
            "password": "test123456",
        })
        assert res.status_code == 422

    def test_register_invalid_email(self, app_client):
        res = app_client.post("/customers/register", json={
            "full_name": "تست ایمیل",
            "email": "not-an-email",
            "password": "test123456",
        })
        assert res.status_code == 422

    def test_register_short_password(self, app_client):
        res = app_client.post("/customers/register", json={
            "full_name": "تست پسورد",
            "email": "shortpass@example.com",
            "password": "12345",
        })
        assert res.status_code == 422


class TestCustomerRequest:
    """تست‌های درخواست مشاوره مشتری."""

    def test_create_customer_request(self, app_client):
        res = app_client.post("/customer-requests", json={
            "full_name": "احمد تست",
            "phone": "09121234567",
            "message": "سلام، نیاز به مشاوره برای خرید دستگاه GC دارم.",
            "subject": "خرید دستگاه",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "request_id" in data

    def test_create_request_short_message(self, app_client):
        res = app_client.post("/customer-requests", json={
            "full_name": "تست",
            "phone": "09121234567",
            "message": "سلام",
        })
        assert res.status_code == 422
