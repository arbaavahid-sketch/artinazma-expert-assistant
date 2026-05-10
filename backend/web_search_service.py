import os
import re
from typing import Any, Dict, List

import requests

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "").strip()
WEB_SEARCH_ENABLED = os.getenv("WEB_SEARCH_ENABLED", "false").strip().lower() == "true"

TAVILY_SEARCH_URL = "https://api.tavily.com/search"

TECHNICAL_QUERY_HINTS = [
    "datasheet",
    "manual",
    "technical specifications",
    "application note",
    "product brochure",
    "official",
]

TRUSTED_DOMAIN_HINTS = [
    "manufacturer",
    "official",
    "datasheet",
    "manual",
    "application note",
    "astm",
    "iso",
    "nist",
    "epa",
    "chromatec",
    "spectron",
    "lumex",
    "hach",
    "mettler",
    "thermo",
    "agilent",
    "shimadzu",
    "perkinelmer",
]


def is_web_search_configured() -> bool:
    return WEB_SEARCH_ENABLED and bool(TAVILY_API_KEY)


def normalize_text(text: str) -> str:
    return (text or "").strip().lower()


def looks_like_specific_model_question(query: str) -> bool:
    text = normalize_text(query)

    model_keywords = [
        "model",
        "datasheet",
        "specification",
        "مشخصات",
        "دیتاشیت",
        "کاتالوگ",
        "مدل",
        "دستگاه",
        "چیست",
        "معرفی",
        "در مورد",
        "درباره",
    ]

    has_model_keyword = any(keyword in text for keyword in model_keywords)

    latin_tokens = re.findall(r"[A-Za-z][A-Za-z0-9\-]{2,}", query or "")
    has_latin_model = len(latin_tokens) >= 1

    return has_model_keyword and has_latin_model


def should_use_web_fallback(
    query: str,
    related_docs: List[Dict[str, Any]],
    search_mode: str = "",
) -> bool:
    if not is_web_search_configured():
        return False

    if not related_docs:
        return True

    best_score = float(related_docs[0].get("score", 0) or 0)

    if search_mode in ["local_astm", "local_fast"] and best_score >= 5:
        return False

    if search_mode == "ai_vector" and best_score < 0.32:
        return True

    if search_mode == "local_fallback":
        return True

    if looks_like_specific_model_question(query) and best_score < 8:
        return True

    return False


def build_search_query(user_query: str) -> str:
    clean_query = " ".join((user_query or "").split())

    if not clean_query:
        return ""

    hint = " ".join(TECHNICAL_QUERY_HINTS)

    return f"{clean_query} {hint}"


def score_web_result(result: Dict[str, Any]) -> float:
    title = normalize_text(result.get("title", ""))
    url = normalize_text(result.get("url", ""))
    content = normalize_text(result.get("content", ""))

    combined = f"{title} {url} {content}"

    score = float(result.get("score", 0) or 0)

    for hint in TRUSTED_DOMAIN_HINTS:
        if hint in combined:
            score += 0.15

    if ".edu" in url or ".gov" in url or ".org" in url:
        score += 0.05

    return score


def search_web_sources(query: str, max_results: int = 5) -> List[Dict[str, Any]]:
    if not is_web_search_configured():
        return []

    search_query = build_search_query(query)

    if not search_query:
        return []

    payload = {
        "api_key": TAVILY_API_KEY,
        "query": search_query,
        "search_depth": "advanced",
        "include_answer": False,
        "include_raw_content": False,
        "max_results": max_results,
    }

    try:
        res = requests.post(
            TAVILY_SEARCH_URL,
            json=payload,
            timeout=25,
        )

        if not res.ok:
            return []

        data = res.json()
        results = data.get("results", []) or []

        cleaned_results = []

        for item in results:
            title = item.get("title", "")
            url = item.get("url", "")
            content = item.get("content", "")

            if not title or not url or not content:
                continue

            cleaned_results.append(
                {
                    "title": title,
                    "url": url,
                    "content": content[:1200],
                    "score": score_web_result(item),
                }
            )

        cleaned_results.sort(key=lambda item: item.get("score", 0), reverse=True)

        return cleaned_results[:max_results]

    except Exception:
        return []


def build_web_context(web_results: List[Dict[str, Any]]) -> str:
    if not web_results:
        return ""

    parts = []

    for index, item in enumerate(web_results, start=1):
        parts.append(f"""
منبع وب {index}
عنوان: {item.get("title", "")}
آدرس: {item.get("url", "")}
امتیاز تقریبی: {item.get("score", 0)}
خلاصه محتوای بازیابی‌شده:
{item.get("content", "")}
""")

    return "\n\n".join(parts)
