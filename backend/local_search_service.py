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


def local_search_knowledge_base(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    store = load_vector_store()

    if not store:
        return []

    query_tokens = tokenize(query)

    if not query_tokens:
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

        score = 0

        for token in query_tokens:
            if token in searchable_text:
                score += searchable_text.count(token)

        # امتیاز ویژه برای کدهای ASTM مثل D 8088 یا D8088
        astm_codes = re.findall(r"d\s*\d{3,5}", normalize_text(query))
        for code in astm_codes:
            compact_code = code.replace(" ", "")
            if code in searchable_text or compact_code in searchable_text.replace(" ", ""):
                score += 20

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


def build_local_answer(query: str, results: List[Dict[str, Any]]) -> str:
    if not results:
        return (
            "در بانک دانش محلی آرتین آزما اطلاعات مرتبط کافی پیدا نشد.\n\n"
            "اگر به اینترنت یا سرویس AI دسترسی نداریم، لازم است فایل استاندارد، کاتالوگ یا گزارش مرتبط "
            "قبلاً به بانک دانش اضافه شده باشد."
        )

    answer_parts = [
        "پاسخ بر اساس بانک دانش محلی آرتین آزما:",
        "",
        "جمع‌بندی:",
        "اطلاعات زیر از فایل‌های موجود در بانک دانش محلی پیدا شده است. چون در این حالت به سرویس AI متصل نیستیم، پاسخ بر اساس متن‌های بازیابی‌شده از منابع داخلی ارائه می‌شود.",
        "",
        "اطلاعات مرتبط:"
    ]

    for index, item in enumerate(results, start=1):
        content = item["content"][:900]

        answer_parts.append(
            f"""
{index}. منبع: {item['title']}
فایل: {item['file_name']}
دسته‌بندی: {item['category']}

{content}
"""
        )

    answer_parts.append(
        "\nبرای پاسخ دقیق‌تر، می‌توانید سوال را با کد استاندارد، نام دستگاه، نوع نمونه یا کاربرد دقیق‌تر بپرسید."
    )

    return "\n".join(answer_parts)