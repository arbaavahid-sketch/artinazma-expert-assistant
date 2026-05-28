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
        import random
        email = f"register_test_{random.randint(10000, 99999)}@example.com"
        res = app_client.post("/customers/register", json={
            "full_name": "تست کاربر",
            "email": email,
            "password": "test123456",
            "company": "شرکت تست",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["customer"]["email"] == email

    def test_login_customer(self, app_client, test_db):
        from repositories.customer_repo import create_customer
        create_customer(full_name="تست لاگین", email="login@example.com", password="login123456")
        res = app_client.post("/customers/login", json={
            "email": "login@example.com",
            "password": "login123456",
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "access_token" in data

    def test_login_wrong_password(self, app_client, test_db):
        from repositories.customer_repo import create_customer
        create_customer(full_name="تست رمز", email="wrongpass@example.com", password="correct123")
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

    def test_profile_with_valid_token(self, app_client, test_db):
        """دسترسی به پروفایل با توکن معتبر."""
        import random
        from repositories.customer_repo import create_customer
        from auth_service import create_access_token

        email = f"profile_{random.randint(10000,99999)}@example.com"
        cust = create_customer(full_name="پروفایل تست", email=email, password="profile123")
        token = create_access_token(customer_id=cust["customer_id"], email=email)

        res = app_client.get(
            f"/customers/{cust['customer_id']}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_profile_access_other_customer(self, app_client, test_db):
        """مشتری A نباید بتواند به پروفایل مشتری B دسترسی داشته باشد."""
        import random
        from repositories.customer_repo import create_customer
        from auth_service import create_access_token

        suffix = random.randint(10000, 99999)
        email_a = f"customer_a_{suffix}@example.com"
        email_b = f"customer_b_{suffix}@example.com"
        cust_a = create_customer(
            full_name="مشتری الف",
            email=email_a,
            password="pass123456",
        )
        cust_b = create_customer(
            full_name="مشتری ب",
            email=email_b,
            password="pass123456",
        )
        token_a = create_access_token(customer_id=cust_a["customer_id"], email=email_a)

        # A tries to access B's profile
        res = app_client.get(
            f"/customers/{cust_b['customer_id']}",
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
