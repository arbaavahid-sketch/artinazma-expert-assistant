"""Standard edition years stay only when a source or the answer's own link shows them."""
import json

import pytest

from edition_years import strip_unsupported_editions as strip


def test_live_eval_cases():
    # q34: no source for D323-26, and the cited D5191 page is the -20 edition.
    a = ("نسخه فعال ASTM D323-26 است و ASTM D5191-22 روش مینی است. "
         "([store.astm.org](https://store.astm.org/standards/d323?utm_source=openai)) "
         "([store.astm.org](https://store.astm.org/d5191-20.html?utm_source=openai))")
    out = strip(a)
    assert "ASTM D323 است" in out and "ASTM D5191 روش" in out
    assert "https://store.astm.org/d5191-20.html" in out  # links are never rewritten
    # q41: the answer cites the official D4057-22 page, so that year is backed up.
    b = "نسخه جاری ASTM D4057-22 است. ([store.astm.org](https://store.astm.org/d4057-22.html?utm_source=openai))"
    assert strip(b) == b


def test_year_in_internal_context_is_kept_including_pdf_formatting():
    context = "Designation: D4057 − 12 (Reapproved 2022) Standard Practice for Manual Sampling"
    assert strip("طبق ASTM D4057-12 نمونه بگیرید.", context) == "طبق ASTM D4057-12 نمونه بگیرید."
    assert strip("طبق ASTM D4057-22 نمونه بگیرید.", context) == "طبق ASTM D4057 نمونه بگیرید."


@pytest.mark.parametrize("text, expected", [
    ("D445-24a", "D445"),
    ("ASTM D6304-20e1", "ASTM D6304"),
    ("D4057-95(2011)", "D4057"),
    ("ASTM E200-23", "ASTM E200"),
    ("ASTM A106-19", "ASTM A106"),
    ("(ASTM D86-23)", "(ASTM D86)"),
])
def test_unsupported_years_are_dropped(text, expected):
    assert strip(text) == expected


@pytest.mark.parametrize("text", [
    "برش C10-40 هیدروکربن‌ها",      # carbon range, not a standard
    "مدل KAPLYA-20 و BNTI04-05",     # model names
    "DB-20-100 و GC-5000",
    "ASTM D86 و ISO 3405:2019",
    "دمای 20-25 درجه",
])
def test_other_hyphenated_text_is_untouched(text):
    assert strip(text) == text


def _offline_chat(monkeypatch, answer_parts):
    import routes.chat as chat_mod

    monkeypatch.setattr(chat_mod, "search_knowledge_base", lambda *a, **k: [])
    monkeypatch.setattr(chat_mod, "local_search_knowledge_base", lambda *a, **k: [])
    monkeypatch.setattr(chat_mod, "find_artinazma_resources", lambda *a, **k: {"links": [], "images": []})
    monkeypatch.setattr(chat_mod, "translate_query_for_search", lambda q: "")
    monkeypatch.setattr(chat_mod, "search_web_sources", lambda *a, **k: [])
    monkeypatch.setattr(chat_mod, "ask_expert_assistant", lambda **k: "".join(answer_parts))
    monkeypatch.setattr(chat_mod, "ask_expert_assistant_stream", lambda **k: iter(answer_parts))
    saved = {}
    monkeypatch.setattr(chat_mod, "save_expert_question", lambda **k: saved.update(k) or 1)
    return saved


def test_stream_sends_corrected_text_on_done_and_saves_it(authenticated_client, monkeypatch):
    saved = _offline_chat(monkeypatch, ["روش ASTM D323", "-26 قدیمی است."])
    res = authenticated_client.post("/chat/stream", json={"message": "تفاوت روش‌های فشار بخار رید چیست؟"})
    events = [json.loads(line[6:]) for line in res.text.splitlines() if line.startswith("data: ")]
    done = next(e for e in events if e["type"] == "done")
    assert done["final_text"] == "روش ASTM D323 قدیمی است."
    assert saved["answer"] == "روش ASTM D323 قدیمی است."


def test_stream_done_has_no_final_text_when_nothing_changed(authenticated_client, monkeypatch):
    _offline_chat(monkeypatch, ["روش ASTM D323 ", "قدیمی است."])
    res = authenticated_client.post("/chat/stream", json={"message": "تفاوت روش‌های فشار بخار رید چیست؟"})
    done = [json.loads(line[6:]) for line in res.text.splitlines() if line.startswith("data: ")][-1]
    assert done["type"] == "done" and "final_text" not in done


def test_chat_returns_corrected_answer(authenticated_client, monkeypatch):
    _offline_chat(monkeypatch, ["طبق ASTM D5191-22 اندازه بگیرید."])
    data = authenticated_client.post("/chat", json={"message": "فشار بخار بنزین را چطور اندازه بگیرم؟"}).json()
    assert "ASTM D5191 اندازه" in data["answer"]
