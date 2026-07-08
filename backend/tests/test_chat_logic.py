"""
تست منطق تصمیم‌گیری مسیر چت (توابع خالص در utils/chat_utils.py).

این توابع مستقیماً رفتار routes/chat.py را کنترل می‌کنند:
- تشخیص سؤال محصول/مدل خاص  → آیا internal context رد شود
- تشخیص سؤال مرتبط با شرکت    → آیا اطلاعات تماس تزریق شود
- تشخیص درخواست تبدیل دنباله‌ای → آیا جستجو رد شود
- تطبیق دقیق مدل در اسناد       → آیا وب‌سرچ فعال شود
هیچ‌کدام به OpenAI نیاز ندارند، پس آفلاین اجرا می‌شوند.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.chat_utils import (
    _ASTM_KNOWN_STANDARDS,
    make_safe_filename,
    is_specific_product_or_model_question,
    context_has_exact_model_match,
    is_artinazma_related_question,
    is_followup_transform_request,
)


class TestMakeSafeFilename:
    def test_spaces_become_underscores(self):
        assert make_safe_filename("my file.pdf") == "my_file.pdf"

    def test_special_chars_stripped(self):
        assert make_safe_filename("a!b@c#.pdf") == "a_b_c_.pdf"

    def test_empty_falls_back(self):
        assert make_safe_filename("") == "uploaded_file"
        assert make_safe_filename(None) == "uploaded_file"  # type: ignore[arg-type]

    def test_persian_preserved(self):
        # کاراکترهای فارسی باید حفظ شوند
        assert "گزارش" in make_safe_filename("گزارش تست.pdf")

    def test_path_components_dropped(self):
        # نباید اجازه‌ی path traversal بدهد
        out = make_safe_filename("../../etc/passwd")
        assert "/" not in out and ".." not in out.split(".")[0]


class TestIsSpecificProductOrModelQuestion:
    def test_pure_technical_acronyms_are_not_model_questions(self):
        # ASTM/GC/HPLC به‌تنهایی سؤال «مدل خاص» نیستند
        assert is_specific_product_or_model_question("ASTM D2622") is False
        assert is_specific_product_or_model_question("تفاوت GC و HPLC") is False

    def test_model_with_part_number_is_detected(self):
        assert is_specific_product_or_model_question("مشخصات مدل ABC-1200 چیست؟") is True

    def test_no_latin_tokens_returns_false(self):
        assert is_specific_product_or_model_question("سولفور دیزل چقدر است؟") is False

    def test_empty_returns_false(self):
        assert is_specific_product_or_model_question("") is False


class TestKnownStandards:
    def test_d3227_uses_silver_nitrate_not_naoh(self):
        description = _ASTM_KNOWN_STANDARDS["D3227"].lower()

        assert "mercaptan sulfur" in description
        assert "silver nitrate" in description
        assert "agno3" in description
        assert "not naoh" in description


class TestContextHasExactModelMatch:
    def test_match_in_doc_content(self):
        docs = [{"content": "دستگاه ABC-1200 موجود است", "title": "", "file_name": ""}]
        assert context_has_exact_model_match("ABC-1200", docs) is True

    def test_no_match(self):
        docs = [{"content": "محصول دیگری", "title": "", "file_name": ""}]
        assert context_has_exact_model_match("ABC-1200", docs) is False

    def test_empty_docs(self):
        assert context_has_exact_model_match("ABC-1200", []) is False


class TestIsArtinazmaRelatedQuestion:
    def test_company_name_triggers(self):
        assert is_artinazma_related_question("آیا آرتین آزما این را دارد؟") is True

    def test_price_inquiry_triggers(self):
        assert is_artinazma_related_question("قیمت این محصول چند است؟") is True

    def test_generic_technical_does_not_trigger(self):
        assert is_artinazma_related_question("تفاوت GC و HPLC چیست؟") is False


class TestIsFollowupTransformRequest:
    def test_table_transform(self):
        assert is_followup_transform_request("این را به جدول تبدیل کن") is True

    def test_summarize_transform(self):
        assert is_followup_transform_request("خلاصه تر کن") is True

    def test_normal_question_is_not_transform(self):
        assert is_followup_transform_request("سولفور دیزل را توضیح بده") is False

    def test_arabic_yeh_kaf_normalized(self):
        # «ك/ي» عربی باید نرمال‌سازی شده و همچنان تشخیص داده شوند
        assert is_followup_transform_request("به جدول تبديل كن") is True


class TestAstmWebSearchFlag:
    """
    وقتی کد ASTM در دیکشنری داخلی شناخته‌شده است، عنوان معتبر تزریق می‌شود و دیگر
    نیازی به وب‌سرچ نیست؛ خاموش‌کردن وب‌سرچ پاسخ را پایدار (بین اجراها یکسان) می‌کند.
    برای کد ناشناخته، لنگر داخلی وجود ندارد پس وب‌سرچ باید روشن بماند.
    """

    def _pipeline(self, message: str):
        from routes.chat import _build_chat_pipeline
        from schemas.models import ChatRequest

        return _build_chat_pipeline(ChatRequest(message=message))

    def test_known_astm_code_disables_web_search(self):
        p = self._pipeline("استاندارد ASTM D445 برای چیست؟")
        assert p["allow_web_search"] is False

    def test_unknown_astm_code_keeps_web_search(self):
        p = self._pipeline("استاندارد ASTM D9999 برای چیست؟")
        assert p["allow_web_search"] is True

    def test_two_digit_astm_code_is_recognized(self):
        # کدهای دو رقمی پرکاربرد (D86/D93/D97/D56) هم باید لنگر بگیرند و قطعی شوند؛
        # web=False یعنی وارد مسیر ASTM شده و عنوان معتبر تزریق شده است.
        for code in ["D86", "D93", "D97", "D56"]:
            p = self._pipeline(f"استاندارد ASTM {code} چیست؟")
            assert p["allow_web_search"] is False, code
            assert "gpt_astm_direct" in p["search_mode"], code

    def test_link_request_injects_correct_official_url(self):
        # درخواست لینک برای کد شناخته‌شده: وب لازم نیست (مدل با وب هم URL غلط می‌ساخت)؛
        # لینک رسمی قطعی (store.astm.org/standards/d<کد>) در context تزریق می‌شود.
        for q in [
            "URL رسمی ASTM D445 چیست؟",
            "لینک دانلود استاندارد ASTM D445 را بده",
            "استاندارد ASTM D445 را از کجا بخرم؟",
        ]:
            p = self._pipeline(q)
            assert p["allow_web_search"] is False, q
            assert "https://store.astm.org/standards/d445" in p["context"], q

    def test_official_url_matches_code_casing_and_form(self):
        # الگوی لینک باید حروف‌کوچک و بدون صفرِ اضافه باشد (d86 نه d0086).
        p = self._pipeline("لینک ASTM D86 را بده")
        assert "https://store.astm.org/standards/d86" in p["context"]
        assert "d0086" not in p["context"]

    def test_unknown_astm_code_link_is_verified(self, monkeypatch):
        # کد خارج از دیکشنری (مثلاً D2887) هنگام درخواست لینک باید با اعتبارسنجی
        # لینک قطعی بگیرد — بدون وب. شبکه را mock می‌کنیم تا تست آفلاین بماند.
        import astm_link_service
        astm_link_service._CACHE.pop("d2887", None)
        monkeypatch.setattr(astm_link_service, "verify_astm_code", lambda code: True)
        p = self._pipeline("لینک استاندارد ASTM D2887 را بده")
        assert p["allow_web_search"] is False
        assert "https://store.astm.org/standards/d2887" in p["context"]

    def test_fake_astm_code_link_is_not_fabricated(self, monkeypatch):
        # کد جعلی (۴۰۴) نباید لینک بگیرد؛ به‌جایش هشدار «یافت نشد».
        import astm_link_service
        astm_link_service._CACHE.pop("d99999", None)
        monkeypatch.setattr(astm_link_service, "verify_astm_code", lambda code: False)
        p = self._pipeline("لینک استاندارد ASTM D99999 را بده")
        assert "https://store.astm.org/standards/d99999" not in p["context"]
        assert "یافت نشد" in p["context"]

    def test_a_series_link_with_astm_prefix(self, monkeypatch):
        # سری A (لوله‌ی فولادی) هم باید لینک بگیرد وقتی پیشوند ASTM دارد.
        import astm_link_service
        astm_link_service._CACHE.pop("a106", None)
        monkeypatch.setattr(astm_link_service, "verify_astm_code", lambda code: True)
        p = self._pipeline("لینک استاندارد ASTM A106 را بده")
        assert p["allow_web_search"] is False
        assert "https://store.astm.org/standards/a106" in p["context"]


class TestAstmCodeExtraction:
    """استخراج کد ASTM از متن — سری‌های غیر-D فقط با پیشوند ASTM."""

    def _codes(self, text):
        from astm_link_service import extract_astm_codes
        return extract_astm_codes(text)

    def test_bare_d_code_matched(self):
        assert self._codes("استاندارد D445 چیست؟") == ["D445"]

    def test_prefixed_any_series_matched(self):
        assert self._codes("لینک ASTM A106 را بده") == ["A106"]
        assert self._codes("ASTM E8 چیست؟") == ["E8"]
        assert self._codes("astm a 106") == ["A106"]

    def test_bare_non_d_code_not_matched(self):
        # «A106» بدون پیشوند ASTM نباید کد تلقی شود (ریسک false-positive).
        assert self._codes("کاغذ A4 و باتری B12") == []

    def test_leading_zeros_and_casing_normalized(self):
        assert self._codes("ASTM d0445") == ["D445"]

    def test_multiple_codes_deduped_in_order(self):
        assert self._codes("ASTM D86 و ASTM A106 و D86") == ["D86", "A106"]


class TestHybridRetrieval:
    """بازیابی ترکیبی: سؤال فارسی باید سند انگلیسیِ مرتبط را از مسیر معنایی بگیرد."""

    def _pipeline(self, message: str, monkeypatch, local_docs, vector_docs):
        import routes.chat as chat_module
        from schemas.models import ChatRequest

        monkeypatch.setattr(
            chat_module, "local_search_knowledge_base", lambda q, top_k=12: local_docs
        )
        monkeypatch.setattr(
            chat_module, "search_knowledge_base", lambda q, top_k=6: vector_docs
        )
        return chat_module._build_chat_pipeline(ChatRequest(message=message))

    @staticmethod
    def _vec_doc(title, cosine, content="DPD method free chlorine ..."):
        # شکل خروجی Qdrant: score نرمال‌شده (اولی همیشه 100) + کسینوس واقعی در breakdown
        return {
            "title": title,
            "file_name": title,
            "category": "water-analysis",
            "content": content,
            "score": 100.0,
            "score_breakdown": {"algorithm": "qdrant_rrf_hybrid", "vector_score": cosine},
        }

    @staticmethod
    def _local_doc(title, score, content="متن فارسی ..."):
        return {"title": title, "file_name": title, "category": "general",
                "content": content, "score": score}

    def test_persian_question_reaches_english_doc(self, monkeypatch):
        # کلیدواژه‌ای ضعیف (سند فارسیِ کم‌ربط) + معناییِ قوی (سند انگلیسی) → سند انگلیسی اول
        p = self._pipeline(
            "روش اندازه‌گیری کلر آزاد در آب چگونه است؟",
            monkeypatch,
            local_docs=[self._local_doc("08-آب-در-نفت.txt", 12.0)],
            vector_docs=[self._vec_doc("Water Analysis.pdf", 0.52)],
        )
        assert p["search_mode"].startswith("hybrid")
        assert p["related_docs"][0]["file_name"] == "Water Analysis.pdf"
        assert "Water Analysis.pdf" in p["context"]

    def test_strong_local_comes_first_but_vector_still_merged(self, monkeypatch):
        p = self._pipeline(
            "روش اندازه‌گیری کلر آزاد در آب چگونه است؟",
            monkeypatch,
            local_docs=[self._local_doc("سند-فارسی-قوی.txt", 40.0)],
            vector_docs=[self._vec_doc("Water Analysis.pdf", 0.45)],
        )
        assert p["search_mode"].startswith("hybrid")
        assert p["related_docs"][0]["file_name"] == "سند-فارسی-قوی.txt"
        assert any(d["file_name"] == "Water Analysis.pdf" for d in p["related_docs"])

    def test_irrelevant_vector_results_filtered(self, monkeypatch):
        # کسینوس زیر آستانه (0.30) نباید وارد context شود؛ نمرهٔ نرمال‌شدهٔ 100 گول نزند.
        p = self._pipeline(
            "روش اندازه‌گیری کلر آزاد در آب چگونه است؟",
            monkeypatch,
            local_docs=[],
            vector_docs=[self._vec_doc("Unrelated.pdf", 0.12)],
        )
        assert all(d["file_name"] != "Unrelated.pdf" for d in p["related_docs"])

    def test_good_vector_match_not_discarded_as_weak(self, monkeypatch):
        # قبلاً نتیجهٔ معنایی با نمرهٔ کوچک (مقیاس 0-1) به‌عنوان context ضعیف دور ریخته می‌شد.
        p = self._pipeline(
            "روش اندازه‌گیری کلر آزاد در آب چگونه است؟",
            monkeypatch,
            local_docs=[],
            vector_docs=[self._vec_doc("Water Analysis.pdf", 0.50)],
        )
        assert "ignored_weak_internal_context" not in p["search_mode"]
        assert p["related_docs"], "نتیجهٔ معنایی خوب نباید حذف شود"

    def test_vector_failure_falls_back_to_local(self, monkeypatch):
        import routes.chat as chat_module
        from schemas.models import ChatRequest

        monkeypatch.setattr(
            chat_module, "local_search_knowledge_base",
            lambda q, top_k=12: [self._local_doc("سند-فارسی.txt", 30.0)],
        )
        def _boom(q, top_k=6):
            raise RuntimeError("embedding down")
        monkeypatch.setattr(chat_module, "search_knowledge_base", _boom)

        p = chat_module._build_chat_pipeline(
            ChatRequest(message="روش اندازه‌گیری کلر آزاد در آب چگونه است؟")
        )
        assert p["related_docs"][0]["file_name"] == "سند-فارسی.txt"
        assert p["search_mode"].startswith("local_fast")
