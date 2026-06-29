"""
تست یکپارچه (integration) برای endpoint اصلی POST /chat.

تمام فراخوانی‌های بیرونی (OpenAI و شبکه) mock می‌شوند تا تست آفلاین و قطعی باشد:
- ask_expert_assistant      → پاسخ ثابت (به‌جای OpenAI)
- search_knowledge_base     → [] (به‌جای embedding OpenAI)
- find_artinazma_resources  → [] (به‌جای کرال شبکه)

بقیه‌ی pipeline (تشخیص intent، جستجوی محلی، DB) آفلاین و واقعی اجرا می‌شود.
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _patch_externals(monkeypatch, answer="پاسخ تستی آرتین", raise_ai=False):
    import routes.chat as chat_mod

    def fake_ask(*args, **kwargs):
        if raise_ai:
            raise RuntimeError("simulated OpenAI failure")
        return answer

    monkeypatch.setattr(chat_mod, "ask_expert_assistant", fake_ask)
    monkeypatch.setattr(chat_mod, "search_knowledge_base", lambda *a, **k: [])
    monkeypatch.setattr(chat_mod, "find_artinazma_resources", lambda *a, **k: [])
    # build_local_answer is used in the fallback path; keep it deterministic
    monkeypatch.setattr(chat_mod, "build_local_answer", lambda *a, **k: "پاسخ محلی")


def test_chat_returns_ai_answer(app_client, monkeypatch):
    _patch_externals(monkeypatch, answer="گوگرد کل با D2622 اندازه‌گیری می‌شود.")

    res = app_client.post("/chat", json={"message": "درباره D2622 توضیح بده"})
    assert res.status_code == 200

    data = res.json()
    assert data["answer"] == "گوگرد کل با D2622 اندازه‌گیری می‌شود."
    assert data["answer_mode"] == "ai"
    assert "question_id" in data
    assert "detected_domain" in data
    assert "search_mode" in data
    assert isinstance(data["sources"], list)


def test_chat_falls_back_to_local_when_ai_fails(app_client, monkeypatch):
    # وقتی AI خطا بدهد، endpoint نباید 500 بدهد؛ باید به پاسخ محلی برگردد
    _patch_externals(monkeypatch, raise_ai=True)

    res = app_client.post("/chat", json={"message": "یک سوال عمومی"})
    assert res.status_code == 200

    data = res.json()
    assert data["answer_mode"] == "local"
    assert data["answer"] == "پاسخ محلی"


def test_chat_persists_question(app_client, monkeypatch):
    # هر درخواست باید در DB ذخیره شود و question_id معتبر برگردد
    _patch_externals(monkeypatch, answer="ذخیره شود")

    res = app_client.post("/chat", json={"message": "سوال برای ذخیره", "user_id": "anonymous"})
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data["question_id"], int)
    assert data["question_id"] > 0

    from repositories.questions_repo import get_question_by_id

    saved = get_question_by_id(data["question_id"])
    assert saved is not None
    assert saved["metadata"]["search_mode"] == data["search_mode"]
    assert saved["metadata"]["web_search_used"] == data["web_search_used"]
    assert saved["metadata"]["question_intent"] == data["question_intent"]
    assert saved["metadata"]["answer_mode"] == data["answer_mode"]
    assert saved["metadata"]["source_count"] == len(data["sources"])


def test_chat_sources_include_citation_fields(app_client, monkeypatch):
    import routes.chat as chat_mod

    _patch_externals(monkeypatch, answer="پاسخ با منبع داخلی")
    monkeypatch.setattr(
        chat_mod,
        "local_search_knowledge_base",
        lambda *a, **k: [
            {
                "title": "JFTOT-230 manual",
                "file_name": "jftot-230.txt",
                "category": "equipment",
                "chunk_index": 3,
                "score": 55,
                "score_reason": "exact code/model match",
                "content": "This chunk explains the JFTOT-230 analyzer configuration.",
            }
        ],
    )

    res = app_client.post("/chat", json={"message": "JFTOT-230 چیست؟"})
    assert res.status_code == 200
    data = res.json()

    assert data["sources"]
    source = data["sources"][0]
    assert source["citation_id"] == "S1"
    assert source["chunk_index"] == 3
    assert source["score_reason"] == "exact code/model match"
    assert "JFTOT-230" in source["excerpt"]


def test_chat_injects_lab_answer_contract_for_d3227(app_client, monkeypatch):
    import routes.chat as chat_mod

    captured = {}

    def fake_ask(*args, **kwargs):
        captured.update(kwargs)
        return "D3227 answer"

    monkeypatch.setattr(chat_mod, "ask_expert_assistant", fake_ask)
    monkeypatch.setattr(chat_mod, "search_knowledge_base", lambda *a, **k: [])
    monkeypatch.setattr(chat_mod, "find_artinazma_resources", lambda *a, **k: [])
    monkeypatch.setattr(chat_mod, "build_local_answer", lambda *a, **k: "local")

    res = app_client.post("/chat", json={"message": "محلول تیترانت رو طبق ASTM D3227 چطوری درست کنم؟"})
    assert res.status_code == 200

    context = captured["context"]
    assert "Laboratory answer contract" in context
    assert "Correctness has priority over style" in context
    assert "ASTM D3227 guardrail" in context
    assert "silver nitrate" in context
    assert "AgNO3" in context
    assert "do not describe it as a NaOH titrant" in context


def test_chat_requires_message_field(app_client, monkeypatch):
    _patch_externals(monkeypatch)
    # بدنه بدون فیلد اجباری message → خطای اعتبارسنجی 422
    res = app_client.post("/chat", json={"domain": "auto"})
    assert res.status_code == 422
