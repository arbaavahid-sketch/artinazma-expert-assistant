"""Solution-preparation questions are answered by the laboratory tools, not the general model."""
import json

import laboratory_chat
import routes.chat as chat_mod

QUESTION = "آرتين جان ميخام محلول 0.02 نرمال اسيد سولفوريك تو يك ليتر بسازم. با استفاده از E200 بهم بگو"
LAB_RESULT = {
    "answer": "برای ۱ لیتر محلول ۰٫۰۲ نرمال، ۰٫۵۵۵ میلی‌لیتر اسید ۹۶٪ لازم است.",
    "calculations": [{"id": "calc-1", "kind": "solution_preparation", "result": {"concentrate_volume_mL": 0.5552}}],
    "proposals": [], "library_resources": None, "failed_calculations": [], "revision": None,
}


def _offline(monkeypatch, lab=LAB_RESULT, general="پاسخ عمومی"):
    calls = {"lab": 0, "general": 0}

    def fake_lab(*args, **kwargs):
        calls["lab"] += 1
        if isinstance(lab, Exception):
            raise lab
        return lab

    def fake_general(*args, **kwargs):
        calls["general"] += 1
        return general

    def fake_general_stream(*args, **kwargs):
        calls["general"] += 1
        yield general

    monkeypatch.setattr(laboratory_chat, "ask_laboratory", fake_lab)
    monkeypatch.setattr(chat_mod, "ask_expert_assistant", fake_general)
    monkeypatch.setattr(chat_mod, "ask_expert_assistant_stream", fake_general_stream)
    monkeypatch.setattr(chat_mod, "search_knowledge_base", lambda *a, **k: [])
    monkeypatch.setattr(chat_mod, "find_artinazma_resources", lambda *a, **k: [])
    return calls


def _events(response):
    return [json.loads(line[6:]) for line in response.text.splitlines() if line.startswith("data: ")]


def test_chat_answers_solution_question_with_lab_tools(authenticated_client, monkeypatch):
    calls = _offline(monkeypatch)
    data = authenticated_client.post("/chat", json={"message": QUESTION}).json()
    assert calls == {"lab": 1, "general": 0}
    assert data["answer"].startswith(LAB_RESULT["answer"])
    assert data["answer_mode"] == "laboratory"
    assert data["search_mode"] == "laboratory_calculation"
    assert data["calculations"][0]["kind"] == "solution_preparation"


def test_stream_answers_solution_question_with_lab_tools(authenticated_client, monkeypatch):
    calls = _offline(monkeypatch)
    events = _events(authenticated_client.post("/chat/stream", json={"message": QUESTION}))
    meta = events[0]
    assert meta["type"] == "meta" and meta["search_mode"] == "laboratory_calculation"
    assert meta["calculations"][0]["id"] == "calc-1"
    assert meta["web_search_used"] is False
    assert "".join(e["text"] for e in events if e["type"] == "chunk").startswith(LAB_RESULT["answer"])
    assert calls == {"lab": 1, "general": 0}


def test_other_questions_keep_the_general_assistant(authenticated_client, monkeypatch):
    calls = _offline(monkeypatch)
    data = authenticated_client.post("/chat", json={"message": "روش ASTM D4294 برای گوگرد چیست؟"}).json()
    assert calls == {"lab": 0, "general": 1}
    assert data["answer_mode"] == "ai" and data["calculations"] == []


def test_lab_failure_or_no_calculation_falls_back(authenticated_client, monkeypatch):
    calls = _offline(monkeypatch, lab=RuntimeError("model unavailable"))
    assert authenticated_client.post("/chat", json={"message": QUESTION}).json()["answer_mode"] == "ai"
    assert calls == {"lab": 1, "general": 1}

    calls = _offline(monkeypatch, lab={**LAB_RESULT, "calculations": []})
    events = _events(authenticated_client.post("/chat/stream", json={"message": QUESTION}))
    assert events[0]["search_mode"] != "laboratory_calculation"
    assert calls == {"lab": 1, "general": 1}
