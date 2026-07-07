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
