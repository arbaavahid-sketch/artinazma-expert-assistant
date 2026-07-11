"""
تست‌های واحد (unit tests) برای سرویس‌های کلیدی بک‌اند.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Set env before imports
os.environ.setdefault("OPENAI_API_KEY", "test_offline_mode")
os.environ.setdefault("JWT_SECRET", "test-jwt-secret")


class TestIntentService:
    """تست تشخیص intent سوالات."""

    def test_detect_technical_intent(self):
        from intent_service import detect_question_intent
        result = detect_question_intent("روش اندازه‌گیری گوگرد با ASTM D4294 چیست؟")
        assert "intent" in result
        assert "label" in result
        assert isinstance(result["intent"], str)

    def test_detect_sales_intent(self):
        from intent_service import detect_question_intent
        result = detect_question_intent("قیمت دستگاه GC چقدر است؟")
        assert "intent" in result


class TestLocalSearch:
    """تست جستجوی محلی پایگاه دانش."""

    def test_local_search_returns_list(self):
        from local_search_service import local_search_knowledge_base
        results = local_search_knowledge_base("تست نمونه", top_k=5)
        assert isinstance(results, list)

    def test_local_search_empty_query(self):
        from local_search_service import local_search_knowledge_base
        results = local_search_knowledge_base("", top_k=5)
        assert isinstance(results, list)

    def test_local_search_returns_score_breakdown_for_exact_code(self, monkeypatch):
        import local_search_service

        monkeypatch.setattr(
            local_search_service,
            "load_vector_store",
            lambda: [
                {
                    "title": "JFTOT analyzer manual",
                    "category": "equipment",
                    "file_name": "jftot-manual.txt",
                    "chunk_index": 0,
                    "content": "The JFTOT-230 is used for jet fuel thermal oxidation testing.",
                }
            ],
        )
        local_search_service._bm25_cache = None
        local_search_service._bm25_store_len = 0

        results = local_search_service.local_search_knowledge_base("JFTOT-230", top_k=3)

        assert results
        assert results[0]["score_breakdown"]["algorithm"] == "local_hybrid"
        assert results[0]["score_breakdown"]["exact_code_boost"] > 0
        assert "exact" in results[0]["score_reason"]


class TestAuthService:
    """تست سرویس احراز هویت JWT."""

    def test_create_and_verify_token(self):
        from auth_service import create_access_token, verify_access_token
        token = create_access_token(customer_id=42, email="test@test.com")
        assert isinstance(token, str)
        assert len(token) > 20

        payload = verify_access_token(token)
        assert payload is not None
        assert payload["sub"] == "42"
        assert payload["email"] == "test@test.com"
        assert payload["type"] == "access"

    def test_verify_invalid_token(self):
        from auth_service import verify_access_token
        result = verify_access_token("invalid.token.here")
        assert result is None

    def test_verify_empty_token(self):
        from auth_service import verify_access_token
        result = verify_access_token("")
        assert result is None

    def test_token_contains_customer_id(self):
        from auth_service import create_access_token, verify_access_token
        token = create_access_token(customer_id=99, email="cust@example.com")
        payload = verify_access_token(token)
        assert int(payload["sub"]) == 99


class TestGoogleDriveService:
    def test_summarize_drive_sync_results(self):
        from google_drive_service import summarize_drive_sync_results

        summary = summarize_drive_sync_results(
            [
                {"success": True, "status": "added", "category": "general"},
                {"success": True, "status": "unchanged", "category": "general"},
                {
                    "success": False,
                    "status": "skipped",
                    "category": "ASTM Standards",
                    "reason": "unsupported_file_type",
                },
                {
                    "success": False,
                    "status": "skipped",
                    "category": "ASTM Standards",
                    "reason": "unsupported_file_type",
                },
            ]
        )

        assert summary["by_status"]["added"] == 1
        assert summary["by_status"]["unchanged"] == 1
        assert summary["by_status"]["skipped"] == 2
        assert summary["skipped_by_reason"]["unsupported_file_type"] == 2
        assert summary["by_category"]["ASTM Standards"] == 2
        assert summary["has_errors"] is True


class TestNotificationServices:
    def test_admin_request_alert_respects_disabled_setting(self):
        from email_service import send_new_customer_request_admin_alert

        ok, message = send_new_customer_request_admin_alert(
            settings={"request_alerts_enabled": False},
            request_id=1,
            full_name="Customer",
            company="Company",
            phone="09120000000",
            email="customer@example.com",
            request_type="consultation",
            subject="Test",
            message="Long enough request message",
        )

        assert ok is False
        assert "disabled" in message

    def test_telegram_status_notification_uses_send_message(self, monkeypatch):
        import telegram_service

        sent: list[str] = []
        monkeypatch.setattr(telegram_service, "send_message", sent.append)

        telegram_service.notify_request_status_changed(
            request_id=42,
            full_name="Customer",
            subject="Quote",
            status_label="قیمت‌گذاری",
        )

        assert sent
        assert "#42" in sent[0]
        assert "قیمت‌گذاری" in sent[0]


class TestHelperFunctions:
    """تست توابع کمکی main.py."""

    def test_is_specific_product_question(self):
        from utils.chat_utils import is_specific_product_or_model_question
        assert is_specific_product_or_model_question("مشخصات دستگاه GC-5000 چیست؟") is True
        assert is_specific_product_or_model_question("XRF چیست؟") is False

    def test_is_artinazma_related(self):
        from utils.chat_utils import is_artinazma_related_question
        assert is_artinazma_related_question("آیا شما دستگاه GC دارید؟") is True
        assert is_artinazma_related_question("روش کار BET چیست؟") is False

    def test_is_followup_transform(self):
        from utils.chat_utils import is_followup_transform_request
        assert is_followup_transform_request("تبدیل به جدول کن") is True
        assert is_followup_transform_request("کوتاه‌تر کن") is True
        assert is_followup_transform_request("گوگرد نفت خام چیست؟") is False

    def test_make_safe_filename(self):
        from utils.chat_utils import make_safe_filename
        assert make_safe_filename("my file (1).pdf") == "my_file__1_.pdf"
        assert make_safe_filename("") == "uploaded_file"
        assert make_safe_filename("..") == "uploaded_file"

    def test_remove_company_mentions(self):
        from utils.chat_utils import remove_company_mentions_if_not_allowed
        text = "آرتین آزما مهر بهترین شرکت است.\nبرای اطلاع بیشتر تماس بگیرید."
        cleaned = remove_company_mentions_if_not_allowed(text)
        assert "آرتین آزما مهر" not in cleaned


def test_normalize_persian_text_cleans_pdf_garble():
    from knowledge_service import normalize_persian_text
    # کشیده حذف، لاتین از فارسی جدا، عربی→فارسی
    assert normalize_persian_text("گیــری") == "گیری"
    assert "SE دستگاه" in normalize_persian_text("SPECTROSCAN SEدستگاه")
    assert normalize_persian_text("كيفيت") == "کیفیت"
    # روی انگلیسی بی‌اثر
    assert normalize_persian_text("SPECTRON SE model") == "SPECTRON SE model"
    assert normalize_persian_text("") == ""
