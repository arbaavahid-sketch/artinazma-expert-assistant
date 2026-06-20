"""
تست‌های پایه API — سلامت سرویس و دسترسی‌های عمومی.
"""

from datetime import datetime, timedelta



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

    def test_deep_health_requires_admin(self, app_client):
        res = app_client.get("/admin/deep-health")
        assert res.status_code == 401

    def test_deep_health_admin_structure(self, app_client, admin_headers):
        res = app_client.get("/admin/deep-health", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert "ok" in data
        assert "checks" in data
        for key in ["database", "openai", "qdrant", "google_drive", "email"]:
            assert key in data["checks"]
            assert "ok" in data["checks"][key]
            assert "status" in data["checks"][key]
        assert data["checks"]["database"]["ok"] is True

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

    def test_admin_business_analytics_structure(self, app_client, admin_headers):
        res = app_client.get("/admin/business-analytics?days=30", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["days"] == 30
        assert "frequent_questions" in data
        assert "top_products" in data
        assert "active_customers" in data
        assert isinstance(data["frequent_questions"], list)
        assert isinstance(data["top_products"], list)
        assert isinstance(data["active_customers"], list)

    def test_admin_management_report_structure(self, app_client, admin_headers, test_db):
        from repositories.questions_repo import save_expert_question, save_question_feedback
        from repositories.requests_repo import save_customer_request, update_customer_request_status

        qid = save_expert_question(
            question="GC detector monthly report test",
            answer="Use FID for hydrocarbons.",
            sources=[],
            detected_domain="chromatography",
            response_time_ms=1200,
        )
        save_question_feedback(qid, "down", "Needs more detail")
        request_id = save_customer_request(
            full_name="Monthly Customer",
            company="Test Co",
            phone="09120000000",
            email="monthly@example.com",
            request_type="equipment",
            subject="GC quote",
            message="Need GC detector quote.",
        )
        update_customer_request_status(request_id, "reviewing")

        res = app_client.get("/admin/management-report?period=month", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["period"] == "month"
        assert "summary" in data
        assert data["summary"]["total_questions"] >= 1
        assert data["summary"]["negative_feedback"] >= 1
        assert any(item["status"] == "reviewing" for item in data["request_statuses"])
        assert data["open_requests"]
        assert data["recommendations"]

    def test_admin_management_report_csv_export(self, app_client, admin_headers):
        res = app_client.get("/admin/report/export?period=month", headers=admin_headers)
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "artin-management-report-month" in res.headers["content-disposition"]
        text = res.content.decode("utf-8-sig")
        assert "ArtinAzma management report" in text
        assert "Negative feedback" in text
        assert "Open requests" in text
        assert "Recommended management actions" in text

    def test_admin_management_report_invalid_month(self, app_client, admin_headers):
        res = app_client.get("/admin/management-report?period=month&month=bad", headers=admin_headers)
        assert res.status_code == 400


class TestAdminBackupSecurity:
    """Backup files must stay constrained to the managed backup directory."""

    def test_backup_list_only_shows_managed_db_files(self, app_client, admin_headers, tmp_path, monkeypatch):
        from routes import knowledge as knowledge_routes

        monkeypatch.setattr(knowledge_routes, "BACKUP_DIR", tmp_path)
        (tmp_path / "app_backup_20260607_120000.db").write_bytes(b"ok")
        (tmp_path / "manual.db").write_bytes(b"hidden")
        (tmp_path / "app_backup_bad.db").write_bytes(b"hidden")

        res = app_client.get("/admin/backup/list", headers=admin_headers)
        assert res.status_code == 200
        names = [item["file_name"] for item in res.json()["backups"]]
        assert names == ["app_backup_20260607_120000.db"]

    def test_backup_download_rejects_unmanaged_file_names(self, app_client, admin_headers, tmp_path, monkeypatch):
        from routes import knowledge as knowledge_routes

        monkeypatch.setattr(knowledge_routes, "BACKUP_DIR", tmp_path)
        (tmp_path / "manual.db").write_bytes(b"hidden")

        res = app_client.get("/admin/backup/download/manual.db", headers=admin_headers)
        assert res.status_code == 404

    def test_backup_delete_rejects_unmanaged_file_names(self, app_client, admin_headers, tmp_path, monkeypatch):
        from routes import knowledge as knowledge_routes

        monkeypatch.setattr(knowledge_routes, "BACKUP_DIR", tmp_path)
        unmanaged = tmp_path / "manual.db"
        unmanaged.write_bytes(b"hidden")

        res = app_client.delete("/admin/backup/manual.db", headers=admin_headers)
        assert res.status_code == 404
        assert unmanaged.exists()


class TestAdminErrorLog:
    """Admin can inspect backend warning/error logs without exposing public access."""

    def test_error_log_requires_admin(self, app_client):
        res = app_client.get("/admin/error-log")
        assert res.status_code == 401

    def test_error_log_reads_recent_json_entries(self, app_client, admin_headers, tmp_path, monkeypatch):
        import json

        log_file = tmp_path / "app.log"
        log_file.write_text(
            "\n".join([
                json.dumps({"ts": "2026-06-07T10:00:00", "level": "WARNING", "logger": "test", "msg": "slow request"}),
                json.dumps({"ts": "2026-06-07T10:01:00", "level": "ERROR", "logger": "test", "msg": "boom", "endpoint": "/chat"}),
            ]),
            encoding="utf-8",
        )
        monkeypatch.setenv("LOG_FILE", str(log_file))

        res = app_client.get("/admin/error-log?limit=10", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["log_file_exists"] is True
        assert data["summary"]["WARNING"] == 1
        assert data["summary"]["ERROR"] == 1
        assert data["entries"][0]["msg"] == "boom"
        assert data["entries"][0]["endpoint"] == "/chat"

    def test_error_log_level_filter(self, app_client, admin_headers, tmp_path, monkeypatch):
        import json

        log_file = tmp_path / "app.log"
        log_file.write_text(
            "\n".join([
                json.dumps({"level": "WARNING", "msg": "warn"}),
                json.dumps({"level": "ERROR", "msg": "err"}),
            ]),
            encoding="utf-8",
        )
        monkeypatch.setenv("LOG_FILE", str(log_file))

        res = app_client.get("/admin/error-log?level=ERROR", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["count"] == 1
        assert data["entries"][0]["level"] == "ERROR"


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

    def test_customer_request_workflow_statuses(self, app_client, admin_headers):
        create_res = app_client.post("/customer-requests", json={
            "full_name": "Workflow Test",
            "phone": "09120000000",
            "message": "Please follow this request through the sales workflow.",
            "subject": "Workflow",
        })
        assert create_res.status_code == 200
        request_id = create_res.json()["request_id"]

        for status in ["reviewing", "pricing", "sent", "closed"]:
            res = app_client.patch(
                f"/customer-requests/{request_id}/status",
                headers=admin_headers,
                json={"status": status},
            )
            assert res.status_code == 200
            assert res.json()["success"] is True

            list_res = app_client.get("/customer-requests?limit=10", headers=admin_headers)
            assert list_res.status_code == 200
            requests = list_res.json()["requests"]
            saved = next(item for item in requests if item["id"] == request_id)
            assert saved["status"] == status

    def test_customer_request_crm_fields(self, app_client, admin_headers):
        create_res = app_client.post("/customer-requests", json={
            "full_name": "CRM Test",
            "phone": "09120000000",
            "message": "Please prioritize this customer request.",
            "subject": "CRM fields",
        })
        assert create_res.status_code == 200
        request_id = create_res.json()["request_id"]

        update_res = app_client.patch(
            f"/customer-requests/{request_id}/crm",
            headers=admin_headers,
            json={
                "priority": "urgent",
                "internal_note": "Call before noon.",
                "assigned_to": "Sales Team",
                "follow_up_at": "2026-06-12",
            },
        )
        assert update_res.status_code == 200
        assert update_res.json()["success"] is True

        list_res = app_client.get("/customer-requests?limit=10", headers=admin_headers)
        assert list_res.status_code == 200
        saved = next(item for item in list_res.json()["requests"] if item["id"] == request_id)
        assert saved["priority"] == "urgent"
        assert saved["internal_note"] == "Call before noon."
        assert saved["assigned_to"] == "Sales Team"
        assert saved["follow_up_at"] == "2026-06-12"

    def test_customer_request_invalid_priority_falls_back_to_normal(self, app_client, admin_headers):
        create_res = app_client.post("/customer-requests", json={
            "full_name": "Priority Test",
            "phone": "09120000000",
            "message": "Please normalize invalid priority.",
            "subject": "Priority",
        })
        request_id = create_res.json()["request_id"]

        app_client.patch(
            f"/customer-requests/{request_id}/crm",
            headers=admin_headers,
            json={"priority": "impossible", "internal_note": "ok"},
        )

        list_res = app_client.get("/customer-requests?limit=10", headers=admin_headers)
        saved = next(item for item in list_res.json()["requests"] if item["id"] == request_id)
        assert saved["priority"] == "normal"

    def test_customer_request_stats_include_follow_up_reminders(self, app_client, admin_headers):
        yesterday = (datetime.now() - timedelta(days=1)).date().isoformat()
        today = datetime.now().date().isoformat()

        overdue_res = app_client.post("/customer-requests", json={
            "full_name": "Overdue Customer",
            "phone": "09120000000",
            "message": "This request needs overdue follow-up.",
            "subject": "Overdue follow up",
        })
        due_today_res = app_client.post("/customer-requests", json={
            "full_name": "Today Customer",
            "phone": "09120000001",
            "message": "This request needs follow-up today.",
            "subject": "Today follow up",
        })
        assert overdue_res.status_code == 200
        assert due_today_res.status_code == 200

        overdue_id = overdue_res.json()["request_id"]
        due_today_id = due_today_res.json()["request_id"]

        app_client.patch(
            f"/customer-requests/{overdue_id}/crm",
            headers=admin_headers,
            json={"priority": "high", "assigned_to": "Sales", "follow_up_at": yesterday},
        )
        app_client.patch(
            f"/customer-requests/{due_today_id}/crm",
            headers=admin_headers,
            json={"priority": "urgent", "assigned_to": "Support", "follow_up_at": today},
        )

        stats_res = app_client.get("/customer-requests/stats", headers=admin_headers)
        assert stats_res.status_code == 200
        data = stats_res.json()
        reminder_summary = data["reminder_summary"]

        assert reminder_summary["overdue_follow_ups"] >= 1
        assert reminder_summary["due_today"] >= 1
        assert reminder_summary["total_attention"] >= 2

    def test_customer_summary_recommends_overdue_follow_up(self, app_client, admin_headers):
        import random

        yesterday = (datetime.now() - timedelta(days=1)).date().isoformat()
        email = f"summary-customer-{random.randint(10000, 99999)}@example.com"
        register_res = app_client.post("/customers/register", json={
            "full_name": "Summary Customer",
            "email": email,
            "phone": "09120000002",
            "password": "StrongPass123",
        })
        assert register_res.status_code == 200
        assert register_res.json()["success"] is True
        customer_id = register_res.json()["customer"]["id"]

        request_res = app_client.post("/customer-requests", json={
            "full_name": "Summary Customer",
            "email": email,
            "phone": "09120000002",
            "message": "Please follow up on this urgent overdue request.",
            "subject": "Summary overdue",
        })
        request_id = request_res.json()["request_id"]
        app_client.patch(
            f"/customer-requests/{request_id}/crm",
            headers=admin_headers,
            json={"priority": "urgent", "assigned_to": "Sales", "follow_up_at": yesterday},
        )

        summary_res = app_client.get(
            f"/admin/customers/{customer_id}/summary",
            headers=admin_headers,
        )
        assert summary_res.status_code == 200
        data = summary_res.json()

        assert data["summary"]["total_requests"] >= 1
        assert data["summary"]["open_requests"] >= 1
        assert data["summary"]["overdue_follow_ups"] >= 1
        assert data["next_action"]["tone"] == "urgent"

    def test_customer_can_view_own_request_history(self, app_client):
        import random

        email = f"request-history-{random.randint(10000, 99999)}@example.com"
        register_res = app_client.post("/customers/register", json={
            "full_name": "Request History Customer",
            "email": email,
            "phone": "09120000003",
            "password": "StrongPass123",
        })
        assert register_res.status_code == 200
        data = register_res.json()
        customer_id = data["customer"]["id"]
        token = data["access_token"]

        request_res = app_client.post("/customer-requests", json={
            "full_name": "Request History Customer",
            "email": email,
            "phone": "09120000003",
            "message": "Please show this request in my dashboard.",
            "subject": "Dashboard request history",
        })
        request_id = request_res.json()["request_id"]

        history_res = app_client.get(
            f"/customers/{customer_id}/requests",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert history_res.status_code == 200
        history_data = history_res.json()
        request_ids = {item["id"] for item in history_data["requests"]}

        assert history_data["success"] is True
        assert request_id in request_ids

        detail_res = app_client.get(
            f"/customers/{customer_id}/requests/{request_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert detail_res.status_code == 200
        detail_data = detail_res.json()

        assert detail_data["success"] is True
        assert detail_data["request"]["id"] == request_id
        assert detail_data["timeline"][0]["key"] == "created"

        update_res = app_client.post(
            f"/customers/{customer_id}/requests/{request_id}/updates",
            headers={"Authorization": f"Bearer {token}"},
            data={"message": "Additional sample details are attached."},
            files={"file": ("sample.txt", b"sample details", "text/plain")},
        )
        assert update_res.status_code == 200
        assert update_res.json()["success"] is True

        updated_detail_res = app_client.get(
            f"/customers/{customer_id}/requests/{request_id}",
            headers={"Authorization": f"Bearer {token}"},
        )
        updated_detail = updated_detail_res.json()
        assert len(updated_detail["updates"]) >= 1
        assert updated_detail["updates"][-1]["file_name"] == "sample.txt"

        admin_list_res = app_client.get("/customer-requests?limit=20", headers={"X-Admin-Key": "test-admin-key-12345"})
        admin_request = next(item for item in admin_list_res.json()["requests"] if item["id"] == request_id)
        assert admin_request["updates"][-1]["message"] == "Additional sample details are attached."

    def test_status_update_creates_customer_notification(self, app_client, admin_headers):
        import random

        email = f"status-notify-{random.randint(10000, 99999)}@example.com"
        register_res = app_client.post("/customers/register", json={
            "full_name": "Status Notify Customer",
            "email": email,
            "phone": "09120000004",
            "password": "StrongPass123",
        })
        assert register_res.status_code == 200
        data = register_res.json()
        customer_id = data["customer"]["id"]
        token = data["access_token"]

        request_res = app_client.post("/customer-requests", json={
            "full_name": "Status Notify Customer",
            "email": email,
            "phone": "09120000004",
            "message": "Please notify me when status changes.",
            "subject": "Status notification",
        })
        request_id = request_res.json()["request_id"]

        update_res = app_client.patch(
            f"/customer-requests/{request_id}/status",
            headers=admin_headers,
            json={"status": "reviewing"},
        )
        assert update_res.status_code == 200
        assert update_res.json()["success"] is True

        notifications_res = app_client.get(
            f"/customers/{customer_id}/notifications",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert notifications_res.status_code == 200
        notifications = notifications_res.json()

        assert notifications["unread_count"] >= 1
        assert any("Status notification" in item["message"] for item in notifications["notifications"])

    def test_create_request_short_message(self, app_client):
        res = app_client.post("/customer-requests", json={
            "full_name": "تست",
            "phone": "09121234567",
            "message": "سلام",
        })
        assert res.status_code == 422
