import re
from typing import List, Dict, Any
from knowledge_service import load_vector_store


def normalize_text(text: str) -> str:
    text = text.lower()
    text = text.replace("ي", "ی").replace("ك", "ک")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def tokenize(text: str) -> List[str]:
    text = normalize_text(text)
    tokens = re.findall(r"[a-zA-Z0-9]+|[\u0600-\u06FF]+", text)
    return [token for token in tokens if len(token) > 1]


def extract_astm_codes(text: str) -> List[str]:
    normalized = normalize_text(text)
    codes = re.findall(r"d\s*\d{3,5}", normalized)
    return [code.replace(" ", "") for code in codes]


def local_search_knowledge_base(query: str, top_k: int = 12) -> List[Dict[str, Any]]:
    store = load_vector_store()

    if not store:
        return []

    query_tokens = tokenize(query)
    astm_codes = extract_astm_codes(query)

    if not query_tokens and not astm_codes:
        return []

    results = []

    for item in store:
        content = item.get("content", "")
        title = item.get("title", "")
        file_name = item.get("file_name", "")
        category = item.get("category", "")

        searchable_text = normalize_text(
            f"{title} {file_name} {category} {content}"
        )

        searchable_compact = searchable_text.replace(" ", "")

        score = 0

        for token in query_tokens:
            if token in searchable_text:
                score += searchable_text.count(token)

        for code in astm_codes:
            if code in searchable_compact:
                score += 50

        if score > 0:
            results.append({
                "score": float(score),
                "title": title,
                "category": category,
                "file_name": file_name,
                "chunk_index": item.get("chunk_index", 0),
                "content": content
            })

    results.sort(key=lambda x: x["score"], reverse=True)

    return results[:top_k]


def get_more_chunks_from_best_file(results: List[Dict[str, Any]], max_chunks: int = 8) -> List[Dict[str, Any]]:
    if not results:
        return []

    best_file = results[0]["file_name"]
    store = load_vector_store()

    file_chunks = [
        {
            "score": 0.0,
            "title": item.get("title", ""),
            "category": item.get("category", ""),
            "file_name": item.get("file_name", ""),
            "chunk_index": item.get("chunk_index", 0),
            "content": item.get("content", "")
        }
        for item in store
        if item.get("file_name") == best_file
    ]

    file_chunks.sort(key=lambda x: x["chunk_index"])

    return file_chunks[:max_chunks]


def extract_relevant_sentences(text: str, query: str, max_sentences: int = 8) -> List[str]:
    query_tokens = tokenize(query)

    sentences = re.split(r"(?<=[.!؟?])\s+|\n+", text)

    scored_sentences = []

    for sentence in sentences:
        clean_sentence = sentence.strip()

        if len(clean_sentence) < 40:
            continue

        normalized_sentence = normalize_text(clean_sentence)

        score = 0

        for token in query_tokens:
            if token in normalized_sentence:
                score += 1

        if score > 0:
            scored_sentences.append((score, clean_sentence))

    scored_sentences.sort(key=lambda x: x[0], reverse=True)

    return [sentence for _, sentence in scored_sentences[:max_sentences]]


def build_local_answer(query: str, results: List[Dict[str, Any]]) -> str:
    if not results:
        return (
            "برای این موضوع اطلاعات کافی در منابع فعلی در دسترس نیست.\n\n"
            "برای پاسخ دقیق‌تر، لطفاً مدل کامل دستگاه، برند، نوع نمونه، کاربرد موردنظر "
            "یا کاتالوگ/دیتاشیت مرتبط را ارسال کنید."
        )

    best_result = results[0]
    title = best_result.get("title", "")
    content = best_result.get("content", "")

    if not content.strip():
        return (
            "اطلاعات مرتبطی پیدا شد، اما متن کافی برای ارائه پاسخ دقیق در دسترس نیست.\n\n"
            "برای پاسخ قطعی، لطفاً دیتاشیت، کاتالوگ یا مدل کامل را ارسال کنید."
        )

    is_persian_query = bool(re.search(r"[\u0600-\u06FF]", query or ""))

    if is_persian_query:
        return (
            "در حال حاضر امکان تولید پاسخ تحلیلی کامل برقرار نیست، اما اطلاعات مرتبطی برای این موضوع پیدا شد.\n\n"
            f"برداشت اولیه: موضوع به «{title or 'منبع مرتبط'}» مربوط است.\n\n"
            "برای ارائه پاسخ دقیق و قابل استناد، لازم است متن منبع توسط مدل تحلیلی پردازش شود یا اطلاعات تکمیلی مثل مدل کامل، کاربرد، نوع نمونه یا دیتاشیت ارسال شود."
        )

    return (
        "Relevant information was found, but a full analytical answer is not available at the moment.\n\n"
        f"Initial match: {title or 'related source'}\n\n"
        "For a reliable answer, please provide the exact model, application, sample type, or datasheet."
    )