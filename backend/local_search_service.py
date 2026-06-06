import re
import math
from typing import List, Dict, Any, Optional
from knowledge_service import load_vector_store


def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.replace("ي", "ی").replace("ك", "ک")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def tokenize(text: str) -> List[str]:
    text = normalize_text(text)
    tokens = re.findall(r"[a-zA-Z0-9]+|[؀-ۿ]+", text)
    return [token for token in tokens if len(token) > 1]


def extract_astm_codes(text: str) -> List[str]:
    normalized = normalize_text(text)
    codes = re.findall(r"d\s*\d{3,5}", normalized)
    return [code.replace(" ", "") for code in codes]


def extract_exact_codes(text: str) -> List[str]:
    normalized = normalize_text(text)
    candidates = re.findall(r"\b(?=[a-z0-9-]*\d)[a-z0-9][a-z0-9-]{2,}\b", normalized)
    astm_codes = set(extract_astm_codes(text))
    return sorted({code.replace(" ", "") for code in candidates if code not in astm_codes})


# ---------------------------------------------------------------------------
# BM25 Index (lazy-built, cached per vector-store snapshot)
# ---------------------------------------------------------------------------
_bm25_cache: Optional[Dict] = None
_bm25_store_len: int = 0

BM25_K1 = 1.5
BM25_B  = 0.75


def _build_bm25_index(store: List[Dict[str, Any]]) -> Dict:
    corpus_tokens: List[List[str]] = []
    for item in store:
        text = f"{item.get('title','')} {item.get('file_name','')} {item.get('category','')} {item.get('content','')}"
        corpus_tokens.append(tokenize(text))

    N = len(corpus_tokens)
    if N == 0:
        return {"idf": {}, "tf": [], "dl": [], "avgdl": 0, "N": 0}

    avgdl = sum(len(d) for d in corpus_tokens) / N

    df: Dict[str, int] = {}
    for doc_tokens in corpus_tokens:
        for term in set(doc_tokens):
            df[term] = df.get(term, 0) + 1

    idf: Dict[str, float] = {}
    for term, freq in df.items():
        idf[term] = math.log((N - freq + 0.5) / (freq + 0.5) + 1)

    tf_list: List[Dict[str, int]] = []
    for doc_tokens in corpus_tokens:
        freq: Dict[str, int] = {}
        for t in doc_tokens:
            freq[t] = freq.get(t, 0) + 1
        tf_list.append(freq)

    return {
        "idf": idf,
        "tf": tf_list,
        "dl": [len(d) for d in corpus_tokens],
        "avgdl": avgdl,
        "N": N,
    }


def _get_bm25_index(store: List[Dict[str, Any]]) -> Dict:
    global _bm25_cache, _bm25_store_len
    if _bm25_cache is None or len(store) != _bm25_store_len:
        _bm25_cache = _build_bm25_index(store)
        _bm25_store_len = len(store)
    return _bm25_cache


def bm25_score(index: Dict, doc_idx: int, query_tokens: List[str]) -> float:
    if index["N"] == 0:
        return 0.0
    idf   = index["idf"]
    tf    = index["tf"][doc_idx]
    dl    = index["dl"][doc_idx]
    avgdl = index["avgdl"]
    score = 0.0
    for term in query_tokens:
        if term not in tf:
            continue
        tf_td       = tf[term]
        term_idf    = idf.get(term, 0.0)
        numerator   = tf_td * (BM25_K1 + 1)
        denominator = tf_td + BM25_K1 * (1 - BM25_B + BM25_B * dl / max(avgdl, 1))
        score += term_idf * (numerator / denominator)
    return score


# ---------------------------------------------------------------------------
# Hybrid search: BM25 + keyword frequency + ASTM boost
# ---------------------------------------------------------------------------

def local_search_knowledge_base(query: str, top_k: int = 12) -> List[Dict[str, Any]]:
    store = load_vector_store()

    if not store:
        return []

    query_tokens = tokenize(query)
    astm_codes   = extract_astm_codes(query)
    exact_codes  = extract_exact_codes(query)

    if not query_tokens and not astm_codes and not exact_codes:
        return []

    bm25_index = _get_bm25_index(store)

    results = []

    for i, item in enumerate(store):
        content   = item.get("content", "")
        title     = item.get("title", "")
        file_name = item.get("file_name", "")
        category  = item.get("category", "")

        searchable_text    = normalize_text(f"{title} {file_name} {category} {content}")
        searchable_compact = searchable_text.replace(" ", "")

        kw_score = 0
        for token in query_tokens:
            if token in searchable_text:
                kw_score += searchable_text.count(token)

        astm_boost = 0
        for code in astm_codes:
            if code in searchable_compact:
                astm_boost += 50

        exact_code_boost = 0
        matched_exact_codes = []
        for code in exact_codes:
            if code in searchable_compact:
                exact_code_boost += 35
                matched_exact_codes.append(code)

        raw_bm25    = bm25_score(bm25_index, i, query_tokens)
        scaled_bm25 = raw_bm25 * 3

        hybrid = 0.4 * kw_score + 0.6 * scaled_bm25 + astm_boost + exact_code_boost

        if hybrid > 0:
            score_breakdown = {
                "algorithm": "local_hybrid",
                "keyword_score": float(kw_score),
                "bm25_score": round(raw_bm25, 4),
                "bm25_scaled": round(scaled_bm25, 4),
                "astm_boost": float(astm_boost),
                "exact_code_boost": float(exact_code_boost),
                "matched_exact_codes": matched_exact_codes,
            }
            results.append(
                {
                    "score":       round(hybrid, 4),
                    "bm25_score":  round(raw_bm25, 4),
                    "kw_score":    float(kw_score),
                    "score_breakdown": score_breakdown,
                    "score_reason": _score_reason(score_breakdown),
                    "title":       title,
                    "category":    category,
                    "file_name":   file_name,
                    "chunk_index": item.get("chunk_index", 0),
                    "content":     content,
                }
            )

    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:top_k]


def _score_reason(breakdown: Dict[str, Any]) -> str:
    parts = []
    if breakdown.get("matched_exact_codes"):
        parts.append("exact code/model match")
    if breakdown.get("astm_boost", 0) > 0:
        parts.append("ASTM code match")
    if breakdown.get("bm25_score", 0) > 0:
        parts.append("BM25 keyword relevance")
    if breakdown.get("keyword_score", 0) > 0:
        parts.append("direct keyword matches")
    return ", ".join(parts) or "hybrid relevance"


def get_more_chunks_from_best_file(
    results: List[Dict[str, Any]], max_chunks: int = 8
) -> List[Dict[str, Any]]:
    if not results:
        return []

    best_file = results[0]["file_name"]
    store = load_vector_store()

    file_chunks = [
        {
            "score":       0.0,
            "title":       item.get("title", ""),
            "category":    item.get("category", ""),
            "file_name":   item.get("file_name", ""),
            "chunk_index": item.get("chunk_index", 0),
            "content":     item.get("content", ""),
        }
        for item in store
        if item.get("file_name") == best_file
    ]

    file_chunks.sort(key=lambda x: x["chunk_index"])
    return file_chunks[:max_chunks]


def extract_relevant_sentences(
    text: str, query: str, max_sentences: int = 8
) -> List[str]:
    query_tokens = tokenize(query)
    sentences    = re.split(r"(?<=[.!؟?])\s+|\n+", text)
    scored       = []

    for sentence in sentences:
        clean = sentence.strip()
        if len(clean) < 40:
            continue
        norm  = normalize_text(clean)
        score = sum(1 for t in query_tokens if t in norm)
        if score > 0:
            scored.append((score, clean))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [s for _, s in scored[:max_sentences]]


def build_local_answer(query: str, results: List[Dict[str, Any]]) -> str:
    is_persian_query = bool(re.search(r"[؀-ۿ]", query or ""))

    if not results:
        if is_persian_query:
            return (
                "جمع‌بندی اولیه:\n"
                "برای این سؤال، منبع داخلی دقیقی پیدا نشد؛ اما این موضوع از نوع دانش فنی عمومی است و نباید پاسخ متوقف شود.\n\n"
                "اقدام پیشنهادی:\n"
                "لطفاً وضعیت اتصال به مدل تحلیلی اصلی را بررسی کنید. در حالت صحیح، آرتین باید حتی بدون منبع داخلی هم پاسخ تخصصی و کاربردی ارائه کند.\n\n"
                "برای پاسخ دقیق‌تر، نوع نمونه، هدف آزمون، عناصر موردنظر، محدوده غلظت و استاندارد موردنیاز را مشخص کنید."
            )
        return (
            "No exact internal source was found. The main analytical model should still answer this technical question. "
            "Please check the main model connection and request logs."
        )

    best_result = results[0]
    title   = best_result.get("title", "") or "منبع مرتبط"
    content = best_result.get("content", "")

    if is_persian_query:
        extracted = extract_relevant_sentences(content, query, 5)
        parts = [
            "جمع‌بندی اولیه:",
            "اطلاعاتی مرتبط با سؤال پیدا شد، اما پاسخ کامل باید توسط مدل تحلیلی اصلی تولید شود.",
            "",
            f"منبع مرتبط: {title}",
        ]
        if extracted:
            parts += ["", "نکات قابل برداشت از متن موجود:"] + [f"• {s}" for s in extracted]
        parts += [
            "",
            "اقدام پیشنهادی:",
            "اگر این پاسخ به جای پاسخ کامل آرتین نمایش داده شده، یعنی فراخوانی مدل اصلی خطا داده است. لاگ بک‌اند را بررسی کنید.",
        ]
        return "\n".join(parts)

    extracted = extract_relevant_sentences(content, query, 5)
    parts = [
        "Relevant information was found, but the main analytical model should generate the full answer.",
        f"Related source: {title}",
    ]
    if extracted:
        parts += ["", "Relevant extracted points:"] + [f"- {s}" for s in extracted]
    parts += ["", "If this fallback is shown instead of the full answer, check the backend logs for the main model error."]
    return "\n".join(parts)
