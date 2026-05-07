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
    is_persian_query = bool(re.search(r"[\u0600-\u06FF]", query or ""))

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
    title = best_result.get("title", "") or "منبع مرتبط"
    content = best_result.get("content", "")

    if is_persian_query:
        extracted_sentences = extract_relevant_sentences(
            text=content,
            query=query,
            max_sentences=5,
        )

        answer_parts = [
            "جمع‌بندی اولیه:",
            "اطلاعاتی مرتبط با سؤال پیدا شد، اما پاسخ کامل باید توسط مدل تحلیلی اصلی تولید شود.",
            "",
            f"منبع مرتبط: {title}",
        ]

        if extracted_sentences:
            answer_parts.append("")
            answer_parts.append("نکات قابل برداشت از متن موجود:")
            for sentence in extracted_sentences:
                answer_parts.append(f"• {sentence}")

        answer_parts.extend([
            "",
            "اقدام پیشنهادی:",
            "اگر این پاسخ به جای پاسخ کامل آرتین نمایش داده شده، یعنی فراخوانی مدل اصلی خطا داده است. لاگ بک‌اند را بررسی کنید؛ معمولاً خطا در API Key، مدل، پارامترهای Responses API، timeout یا web_search رخ می‌دهد.",
        ])

        return "\n".join(answer_parts)

    extracted_sentences = extract_relevant_sentences(
        text=content,
        query=query,
        max_sentences=5,
    )

    answer_parts = [
        "Relevant information was found, but the main analytical model should generate the full answer.",
        f"Related source: {title}",
    ]

    if extracted_sentences:
        answer_parts.append("")
        answer_parts.append("Relevant extracted points:")
        for sentence in extracted_sentences:
            answer_parts.append(f"- {sentence}")

    answer_parts.append("")
    answer_parts.append(
        "If this fallback is shown instead of the full answer, check the backend logs for the main model error."
    )

    return "\n".join(answer_parts)