"""
تست‌های واحد (unit) برای repository layer — بدون HTTP، مستقیم با دیتابیس.
"""

import random
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("OPENAI_API_KEY", "test_offline_mode")
os.environ.setdefault("ADMIN_API_KEY", "test-admin-key-12345")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-for-testing-only")


class TestSettingsRepo:
    """تست get/set setting در دیتابیس."""

    def test_set_and_get_setting(self, test_db):
        from repositories.settings_repo import get_setting, set_setting
        set_setting("test_key_unit", "hello_world")
        assert get_setting("test_key_unit") == "hello_world"

    def test_get_nonexistent_setting_empty(self, test_db):
        """get_setting برای کلید ناموجود رشته خالی یا None برمی‌گرداند."""
        from repositories.settings_repo import get_setting
        result = get_setting("nonexistent_key_xyz_123")
        assert not result  # خالی یا None — هر دو قابل قبول است

    def test_get_setting_with_default(self, test_db):
        from repositories.settings_repo import get_setting
        result = get_setting("nonexistent_key_xyz_456", "default_val")
        assert result == "default_val"

    def test_overwrite_setting(self, test_db):
        from repositories.settings_repo import get_setting, set_setting
        set_setting("overwrite_key_unit", "first")
        set_setting("overwrite_key_unit", "second")
        assert get_setting("overwrite_key_unit") == "second"


class TestQuestionsRepo:
    """تست ذخیره و بازیابی سوالات.

    امضای واقعی save_expert_question:
        (question, answer, sources, detected_domain, response_time_ms=None)
    """

    def _save_q(self, question="سوال تست", answer="پاسخ تست", domain="general"):
        from repositories.questions_repo import save_expert_question
        return save_expert_question(
            question=question,
            answer=answer,
            sources=[],
            detected_domain=domain,
            response_time_ms=300,
        )

    def test_save_question_returns_id(self, test_db):
        qid = self._save_q("تفاوت FID و TCD چیست؟", "FID برای هیدروکربن‌ها مناسب است.", "chromatography")
        assert isinstance(qid, int)
        assert qid > 0

    def test_get_question_by_id(self, test_db):
        from repositories.questions_repo import get_question_by_id
        qid = self._save_q("BET آنالیز چیست؟", "BET مساحت سطح کاتالیست را اندازه می‌گیرد.", "catalyst")
        q = get_question_by_id(qid)
        assert q is not None
        assert q["question"] == "BET آنالیز چیست؟"
        assert q["detected_domain"] == "catalyst"

    def test_get_nonexistent_question(self, test_db):
        from repositories.questions_repo import get_question_by_id
        assert get_question_by_id(999999) is None

    def test_get_recent_questions(self, test_db):
        from repositories.questions_repo import get_recent_questions
        for i in range(3):
            self._save_q(f"سوال تست repo شماره {i}")
        recent = get_recent_questions(limit=10)
        assert isinstance(recent, list)
        assert len(recent) >= 3

    def test_question_stats_structure(self, test_db):
        from repositories.questions_repo import get_question_stats
        stats = get_question_stats()
        assert isinstance(stats, dict)
        assert len(stats) > 0

    def test_save_question_feedback(self, test_db):
        from repositories.questions_repo import save_question_feedback
        qid = self._save_q("سوال feedback")
        result = save_question_feedback(qid, "up", "خوب بود")
        assert result is True

    def test_update_question_review(self, test_db):
        from repositories.questions_repo import update_question_review, get_question_by_id
        qid = self._save_q("سوال review")
        result = update_question_review(qid, expert_status="approved", expert_note="تایید شد", reviewed_answer="")
        assert result is True
        q = get_question_by_id(qid)
        assert q["expert_status"] == "approved"


class TestCustomerRepo:
    """تست عملیات مشتری در لایه repository.

    امضای واقعی create_customer:
        (full_name, email, password, company='', phone='')
    """

    def _unique_email(self, prefix="repo"):
        return f"{prefix}_{random.randint(10000, 99999)}@example.com"

    def test_hash_and_verify_password(self, test_db):
        from repositories.customer_repo import hash_password, verify_password
        hashed = hash_password("mypassword123")
        assert isinstance(hashed, str)
        assert hashed != "mypassword123"
        assert verify_password("mypassword123", hashed) is True
        assert verify_password("wrongpassword", hashed) is False

    def test_create_customer(self, test_db):
        from repositories.customer_repo import create_customer
        customer = create_customer(
            full_name="رضا تست",
            email=self._unique_email("create"),
            password="password123",
            company="شرکت تست",
        )
        assert customer is not None
        assert "customer_id" in customer
        assert isinstance(customer["customer_id"], int)

    def test_create_duplicate_email(self, test_db):
        from repositories.customer_repo import create_customer
        email = self._unique_email("dup")
        create_customer(full_name="اول", email=email, password="pass123")
        result = create_customer(full_name="دوم", email=email, password="pass456")
        assert result is not None
        assert result.get("success") is False

    def test_authenticate_customer(self, test_db):
        from repositories.customer_repo import create_customer, authenticate_customer, set_customer_approval_status
        email = self._unique_email("auth")
        pw = "securepass456"
        created = create_customer(full_name="احراز هویت تست", email=email, password=pw)
        set_customer_approval_status(created["customer_id"], "approved")
        customer = authenticate_customer(email, pw)
        assert customer is not None
        assert customer["email"] == email

    def test_authenticate_wrong_password(self, test_db):
        from repositories.customer_repo import create_customer, authenticate_customer
        email = self._unique_email("wrongpw")
        create_customer(full_name="رمز اشتباه", email=email, password="correctpass")
        result = authenticate_customer(email, "wrongpass")
        assert result is None

    def test_get_customer_by_id(self, test_db):
        from repositories.customer_repo import create_customer, get_customer_by_id
        email = self._unique_email("byid")
        customer = create_customer(full_name="آیدی تست", email=email, password="pass123")
        cid = customer["customer_id"]
        fetched = get_customer_by_id(cid)
        assert fetched is not None
        assert fetched["id"] == cid

    def test_get_nonexistent_customer(self, test_db):
        from repositories.customer_repo import get_customer_by_id
        assert get_customer_by_id(999999) is None


class TestChatRepo:
    """تست ایجاد session و ذخیره پیام چت."""

    def _make_customer(self):
        from repositories.customer_repo import create_customer
        email = f"chatrepo_{random.randint(10000, 99999)}@example.com"
        c = create_customer(full_name="چت تست", email=email, password="pass123")
        return c["customer_id"]

    def test_create_session(self, test_db):
        from repositories.chat_repo import create_chat_session
        cid = self._make_customer()
        session_id = create_chat_session(cid, "سشن اول تست")
        assert isinstance(session_id, int)
        assert session_id > 0

    def test_save_and_retrieve_message(self, test_db):
        from repositories.chat_repo import create_chat_session, save_chat_message, get_chat_messages
        cid = self._make_customer()
        sid = create_chat_session(cid, "سشن پیام")
        save_chat_message(sid, "user", "سوال تست", {"domain": "general"})
        save_chat_message(sid, "assistant", "پاسخ تست", {})
        messages = get_chat_messages(sid, cid)
        assert len(messages) == 2
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "سوال تست"

    def test_get_customer_sessions(self, test_db):
        from repositories.chat_repo import create_chat_session, get_customer_chat_sessions
        cid = self._make_customer()
        create_chat_session(cid, "سشن A")
        create_chat_session(cid, "سشن B")
        sessions = get_customer_chat_sessions(cid)
        assert len(sessions) >= 2

    def test_delete_session(self, test_db):
        from repositories.chat_repo import create_chat_session, delete_chat_session, get_customer_chat_sessions
        cid = self._make_customer()
        sid = create_chat_session(cid, "سشن حذفی")
        result = delete_chat_session(sid, cid)
        assert result is True
        sessions = get_customer_chat_sessions(cid)
        assert all(s["id"] != sid for s in sessions)

    def test_delete_all_sessions(self, test_db):
        from repositories.chat_repo import create_chat_session, delete_all_customer_chat_sessions, get_customer_chat_sessions
        cid = self._make_customer()
        create_chat_session(cid, "سشن ۱")
        create_chat_session(cid, "سشن ۲")
        count = delete_all_customer_chat_sessions(cid)
        assert count >= 2
        assert get_customer_chat_sessions(cid) == []


class TestDetectDomain:
    """تست تشخیص domain از متن سوال."""

    def test_chromatography_domain(self):
        from db_service import detect_domain
        assert detect_domain("کروماتوگرافی چیست؟") == "chromatography"

    def test_catalyst_domain(self):
        from db_service import detect_domain
        assert detect_domain("کاتالیست ریفرمینگ نفتا بررسی می‌شود") == "catalyst"

    def test_mercury_domain(self):
        from db_service import detect_domain
        assert detect_domain("اندازه‌گیری جیوه در نفت") == "mercury-analysis"

    def test_sulfur_domain(self):
        from db_service import detect_domain
        assert detect_domain("اندازه‌گیری سولفور در گاز طبیعی") == "sulfur-analysis"

    def test_troubleshooting_domain(self):
        from db_service import detect_domain
        # استفاده از واژه‌ای که فقط با troubleshooting match می‌کند
        assert detect_domain("مشکل عیب‌یابی در دستگاه وجود دارد") == "troubleshooting"

    def test_general_domain(self):
        from db_service import detect_domain
        assert detect_domain("سلام چطوری؟") == "general"
