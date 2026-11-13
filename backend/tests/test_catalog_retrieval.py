"""Device-recommendation questions get catalog slots in the chat context."""
import pytest

import catalog_retrieval
from catalog_retrieval import find_catalog_docs, is_device_request, merge_catalog_docs
from utils.chat_utils import is_specific_product_or_model_question


def _doc(file_name, cosine, category="equipment", content="brochure text"):
    return {"title": file_name, "file_name": file_name, "category": category, "content": content,
            "score": 100.0, "score_breakdown": {"vector_score": cosine}}


@pytest.mark.parametrize("message", [
    "برای اندازه‌گیری نقطه ریزش (pour point) چه دستگاهی پیشنهاد می‌دهی؟",
    "برای آنالیز سریع پروتئین و رطوبت غلات چه دستگاهی دارید؟",
    "برای تعیین نقطه قطره‌ای‌شدن (dropping point) گریس چه دستگاهی مناسب است؟",
    "یک تیتراتور پتانسیومتری برای مرکاپتان می‌خواهم",
    "برای آنالیز فلزات سنگین در خاک، یک دستگاه معرفی کن.",
    "which instrument do you recommend for flash point of diesel?",
])
def test_device_requests_are_recognised(message):
    assert is_device_request(message)


@pytest.mark.parametrize("message", [
    "گراویتی API چیست و چه رابطه‌ای با چگالی دارد؟",
    "تفاوت TAN و TBN در روغن چیست؟",
    "ISO/IEC 17025 چیست و چه چیزی را برای آزمایشگاه تضمین می‌کند؟",
    "دستگاه GC ما نویز و دریفت زیاد در بیس‌لاین دارد. از کجا باید عیب‌یابی کنم؟",
    "چرا اندازه‌گیری جیوه در گاز طبیعی مهم است و چطور انجام می‌شود؟",
])
def test_concept_and_troubleshooting_questions_are_not_device_requests(message):
    assert not is_device_request(message)


@pytest.mark.parametrize("message, expected", [
    ("برای تعیین نقطه قطره‌ای‌شدن (dropping point) گریس چه دستگاهی مناسب است؟", False),
    ("دستگاه Dropping Point Apparatus پیشنهاد بده", False),
    ("مشخصات دستگاه Spectroscan SE چیست؟", True),
    ("مشخصات دستگاه KAPLYA-20", True),
    ("دستگاه Hach DR6000 چطوره", True),
])
def test_plain_english_words_are_not_model_names(message, expected):
    # "dropping" used to count as a model name, which dropped all knowledge-base context.
    assert is_specific_product_or_model_question(message) is expected


def test_catalog_search_uses_both_languages_one_chunk_per_file(monkeypatch):
    calls = []

    def fake_search(query, top_k=5, category_filter=None):
        calls.append((query, category_filter))
        if query == "grain protein analyzer":
            return [_doc("InfraLUM FT-12.pdf", 0.41), _doc("InfraLUM FT-12.pdf", 0.39), _doc("Weak.pdf", 0.05)]
        return [_doc("Lumex catalog.pdf", 0.22)]

    monkeypatch.setattr(catalog_retrieval, "search_knowledge_base", fake_search)
    docs = find_catalog_docs("پروتئین غلات چه دستگاهی دارید؟", "grain protein analyzer")
    assert [d["file_name"] for d in docs] == ["InfraLUM FT-12.pdf", "Lumex catalog.pdf"]
    assert all(d["catalog_match"] for d in docs)
    assert {q for q, _ in calls} == {"پروتئین غلات چه دستگاهی دارید؟", "grain protein analyzer"}
    assert all(set(c) == {"equipment", "products"} for _, c in calls)


def test_catalog_search_failure_returns_nothing(monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("qdrant down")

    monkeypatch.setattr(catalog_retrieval, "search_knowledge_base", boom)
    assert find_catalog_docs("چه دستگاهی پیشنهاد می‌کنید؟") == []


def test_merge_reserves_catalog_slots_without_duplicates():
    general = [_doc(f"ASTM D{n}.pdf", 0.5, category="ASTM Standards") for n in range(10)]
    catalog = [_doc("KAPLYA-20.pdf", 0.3), general[1]]  # one catalog hit is already a general source
    merged = merge_catalog_docs(general, catalog)
    names = [d["file_name"] for d in merged]
    assert len(merged) == 8 and len(set(names)) == 8
    assert names[:3] == ["ASTM D0.pdf", "ASTM D2.pdf", "ASTM D3.pdf"]
    assert names[3:5] == ["KAPLYA-20.pdf", "ASTM D1.pdf"]
    assert merge_catalog_docs(general, []) == general[:8]


def test_pipeline_puts_catalog_in_context_for_device_questions(monkeypatch):
    import routes.chat as chat_module
    from schemas.models import ChatRequest

    monkeypatch.setattr(chat_module, "local_search_knowledge_base", lambda q, top_k=12: [])
    monkeypatch.setattr(chat_module, "search_knowledge_base",
                        lambda q, top_k=10: [_doc("ASTM D2265.pdf", 0.45, category="ASTM Standards")])
    monkeypatch.setattr(chat_module, "translate_query_for_search", lambda q: "grease dropping point apparatus")
    seen = {}

    def fake_catalog(message, english_query=None):
        seen["en"] = english_query
        return [{**_doc("KAPLYA-20 Brochure.pdf", 0.35, content="KAPLYA-20 dropping point ASTM D2265"),
                 "catalog_match": True}]

    monkeypatch.setattr(chat_module, "find_catalog_docs", fake_catalog)
    p = chat_module._build_chat_pipeline(
        ChatRequest(message="برای تعیین نقطه قطره‌ای‌شدن (dropping point) گریس چه دستگاهی مناسب است؟"))
    files = [d["file_name"] for d in p["related_docs"]]
    assert files == ["ASTM D2265.pdf", "KAPLYA-20 Brochure.pdf"]
    assert seen["en"] == "grease dropping point apparatus"
    assert "+catalog" in p["search_mode"]
    assert "KAPLYA-20 dropping point" in p["context"] and "قواعد پیشنهاد دستگاه" in p["context"]


def test_pipeline_skips_catalog_for_concept_questions(monkeypatch):
    import routes.chat as chat_module
    from schemas.models import ChatRequest

    monkeypatch.setattr(chat_module, "local_search_knowledge_base", lambda q, top_k=12: [])
    monkeypatch.setattr(chat_module, "search_knowledge_base", lambda q, top_k=10: [])
    monkeypatch.setattr(chat_module, "translate_query_for_search", lambda q: "")

    def unexpected(*a, **k):
        raise AssertionError("catalog search should not run")

    monkeypatch.setattr(chat_module, "find_catalog_docs", unexpected)
    p = chat_module._build_chat_pipeline(ChatRequest(message="تفاوت TAN و TBN در روغن چیست؟"))
    assert "+catalog" not in p["search_mode"]
