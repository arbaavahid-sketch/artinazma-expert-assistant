"""
تست‌های مدیریت session چت مشتری.
"""

import pytest
import random


def _make_customer_via_repo(email: str | None = None) -> dict:
    """ایجاد مشتری مستقیماً از طریق repository — بدون HTTP و rate limit."""
    from repositories.customer_repo import create_customer, set_customer_approval_status
    from auth_service import create_access_token

    email = email or f"sess_{random.randint(10000, 99999)}@example.com"
    customer = create_customer(
        full_name="مشتری سشن تست",
        email=email,
        password="session123456",
        company="شرکت تست",
    )
    set_customer_approval_status(customer["customer_id"], "approved")
    token = create_access_token(customer_id=customer["customer_id"], email=email)
    return {
        "token": token,
        "customer_id": customer["customer_id"],
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture(scope="module")
def registered_customer(test_db):
    """مشتری تست — یک بار برای کل ماژول ایجاد می‌شود."""
    return _make_customer_via_repo()  # random email — avoids cross-run collisions


class TestChatSessionCRUD:
    """تست ایجاد، خواندن و حذف session چت."""

    def test_create_session(self, app_client, registered_customer):
        res = app_client.post(
            "/customers/chat-sessions",
            json={
                "customer_id": registered_customer["customer_id"],
                "title": "گفتگوی آزمایشی",
            },
            headers=registered_customer["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert "session_id" in data
        assert isinstance(data["session_id"], int)

    def test_list_sessions_empty_or_populated(self, app_client, registered_customer):
        cid = registered_customer["customer_id"]
        res = app_client.get(
            f"/customers/{cid}/chat-sessions",
            headers=registered_customer["headers"],
        )
        assert res.status_code == 200
        data = res.json()
        assert "sessions" in data
        assert isinstance(data["sessions"], list)

    def test_list_sessions_after_create(self, app_client, registered_customer):
        cid = registered_customer["customer_id"]
        headers = registered_customer["headers"]

        # ایجاد دو سشن اضافه
        for title in ["سشن الف", "سشن ب"]:
            app_client.post(
                "/customers/chat-sessions",
                json={"customer_id": cid, "title": title},
                headers=headers,
            )

        res = app_client.get(f"/customers/{cid}/chat-sessions", headers=headers)
        assert res.status_code == 200
        assert len(res.json()["sessions"]) >= 2

    def test_delete_session(self, app_client, registered_customer):
        cid = registered_customer["customer_id"]
        headers = registered_customer["headers"]

        create_res = app_client.post(
            "/customers/chat-sessions",
            json={"customer_id": cid, "title": "سشن برای حذف"},
            headers=headers,
        )
        session_id = create_res.json()["session_id"]

        del_res = app_client.delete(
            f"/customers/{cid}/chat-sessions/{session_id}",
            headers=headers,
        )
        assert del_res.status_code == 200
        assert del_res.json()["success"] is True

    def test_delete_other_customer_session_forbidden(self, app_client, test_db):
        """مشتری نباید بتواند سشن مشتری دیگری را حذف کند."""
        cust_a = _make_customer_via_repo()
        cust_b = _make_customer_via_repo()

        create_res = app_client.post(
            "/customers/chat-sessions",
            json={"customer_id": cust_a["customer_id"], "title": "سشن خصوصی A"},
            headers=cust_a["headers"],
        )
        session_id = create_res.json()["session_id"]

        del_res = app_client.delete(
            f"/customers/{cust_a['customer_id']}/chat-sessions/{session_id}",
            headers=cust_b["headers"],
        )
        assert del_res.status_code in (401, 403)

    def test_session_without_auth_rejected(self, app_client, registered_customer):
        cid = registered_customer["customer_id"]
        res = app_client.get(f"/customers/{cid}/chat-sessions")
        assert res.status_code == 401


class TestChatMessages:
    """تست ذخیره و خواندن پیام‌های چت."""

    def test_save_and_get_messages(self, app_client, test_db):
        cust = _make_customer_via_repo()
        cid = cust["customer_id"]
        headers = cust["headers"]

        create_res = app_client.post(
            "/customers/chat-sessions",
            json={"customer_id": cid, "title": "سشن پیام‌ها"},
            headers=headers,
        )
        session_id = create_res.json()["session_id"]

        msg_res = app_client.post(
            "/customers/chat-messages",
            json={
                "customer_id": cid,
                "session_id": session_id,
                "role": "user",
                "content": "سلام آرتین، چطوری؟",
                "metadata": {},
            },
            headers=headers,
        )
        assert msg_res.status_code == 200
        assert msg_res.json()["success"] is True

        get_res = app_client.get(
            f"/customers/{cid}/chat-sessions/{session_id}/messages",
            headers=headers,
        )
        assert get_res.status_code == 200
        messages = get_res.json()["messages"]
        assert len(messages) >= 1
        assert messages[0]["content"] == "سلام آرتین، چطوری؟"
        assert messages[0]["role"] == "user"

    def test_get_messages_without_auth(self, app_client, registered_customer):
        cid = registered_customer["customer_id"]
        res = app_client.get(f"/customers/{cid}/chat-sessions/999/messages")
        assert res.status_code == 401

    def test_search_chat_history(self, app_client, test_db):
        cust = _make_customer_via_repo()
        cid = cust["customer_id"]
        headers = cust["headers"]

        create_res = app_client.post(
            "/customers/chat-sessions",
            json={"customer_id": cid, "title": "HPLC troubleshooting"},
            headers=headers,
        )
        session_id = create_res.json()["session_id"]

        app_client.post(
            "/customers/chat-messages",
            json={
                "customer_id": cid,
                "session_id": session_id,
                "role": "assistant",
                "content": "برای فشار بالای HPLC ابتدا ستون و فریت ورودی را بررسی کنید.",
                "metadata": {},
            },
            headers=headers,
        )

        res = app_client.get(
            f"/customers/{cid}/chat-history/search?q=HPLC",
            headers=headers,
        )

        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["total"] >= 1
        assert data["results"][0]["session_id"] == session_id
        assert "HPLC" in data["results"][0]["snippet"]

    def test_search_chat_history_requires_auth(self, app_client, registered_customer):
        cid = registered_customer["customer_id"]
        res = app_client.get(f"/customers/{cid}/chat-history/search?q=HPLC")
        assert res.status_code == 401
