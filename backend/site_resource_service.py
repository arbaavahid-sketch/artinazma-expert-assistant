import os
import re
import time
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse
from artinazma_index_service import search_artinazma_index, rebuild_artinazma_index
import requests
from bs4 import BeautifulSoup

from artinazma_index_service import search_artinazma_index, load_index

ARTINAZMA_BASE_URL = os.getenv("ARTINAZMA_BASE_URL", "https://artinazma.net").rstrip(
    "/"
)

SEARCH_TIMEOUT = float(os.getenv("ARTINAZMA_SEARCH_TIMEOUT", "20"))
MIN_SCORE = int(os.getenv("ARTINAZMA_MIN_RESOURCE_SCORE", "5"))
CACHE_TTL_SECONDS = int(os.getenv("ARTINAZMA_RESOURCE_CACHE_TTL", "1800"))

_cache: Dict[str, Dict] = {}

MANUAL_ARTINAZMA_RESOURCES = [
    {
        "keywords": [
            "spectroscan se",
            "spectroscan",
            "spectron",
            "آنالایزر گوگرد",
            "گوگرد",
            "sulfur analyzer",
        ],
        "title": "Spectroscan SE",
        "url": "https://artinazma.net/",
        "image_url": "",
    },
]
PRODUCT_INTENT_KEYWORDS = [
    # فارسی
    "دستگاه",
    "تجهیز",
    "تجهیزات",
    "آنالایزر",
    "مدل",
    "برند",
    "کاتالوگ",
    "دیتاشیت",
    "مشخصات",
    "محصول",
    "مواد شیمیایی",
    "ماده شیمیایی",
    "کاتالیست",
    "جاذب",
    "رزین",
    "افزودنی",
    "حلال",
    "استاندارد",
    "خرید",
    "قیمت",
    "موجودی",
    # English
    "device",
    "equipment",
    "instrument",
    "analyzer",
    "model",
    "brand",
    "catalog",
    "datasheet",
    "specification",
    "product",
    "chemical",
    "catalyst",
    "adsorbent",
    "resin",
    "additive",
    "solvent",
    "standard",
    "price",
    "buy",
    "availability",
]


STOP_WORDS_FA = {
    "چیست",
    "چیه",
    "درباره",
    "درمورد",
    "در",
    "مورد",
    "برای",
    "توضیح",
    "بده",
    "معرفی",
    "کن",
    "مشخصات",
    "دستگاه",
    "مدل",
    "محصول",
    "مواد",
    "شیمیایی",
    "آیا",
    "هست",
    "است",
    "لینک",
    "عکس",
    "تصویر",
}


def find_manual_resource(message: str) -> Dict[str, List[Dict]]:
    text = normalize_text(message)

    links = []
    images = []

    for item in MANUAL_ARTINAZMA_RESOURCES:
        matched = any(
            normalize_text(keyword) in text for keyword in item.get("keywords", [])
        )

        if not matched:
            continue

        links.append(
            {
                "title": item["title"],
                "url": item["url"],
                "source": "artinazma.net",
                "score": 100,
            }
        )

        if item.get("image_url"):
            images.append(
                {
                    "title": item["title"],
                    "url": item["image_url"],
                    "page_url": item["url"],
                    "source": "artinazma.net",
                }
            )

    return {
        "links": links,
        "images": images,
        "resources_found": bool(links),
    }


def is_product_or_material_question(message: str) -> bool:
    text = (message or "").lower()

    if any(keyword.lower() in text for keyword in PRODUCT_INTENT_KEYWORDS):
        return True

    # مدل‌های لاتین مثل Spectroscan SE یا RA-915M
    has_latin_model = bool(
        re.search(r"[A-Za-z][A-Za-z0-9\-]{2,}(?:\s+[A-Za-z0-9\-]{2,})?", message or "")
    )

    return has_latin_model


def normalize_text(text: str) -> str:
    text = text or ""
    text = text.lower()
    text = re.sub(r"[\u200c\s]+", " ", text)
    text = re.sub(r"[^\w\s\-\u0600-\u06FF]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def is_artinazma_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        return host in ["artinazma.net", "www.artinazma.net"]
    except Exception:
        return False


def clean_url(url: str) -> str:
    return url.split("#")[0].strip()


def fetch_html(url: str) -> Optional[str]:
    try:
        response = requests.get(
            url,
            timeout=SEARCH_TIMEOUT,
            headers={"User-Agent": "ArtinAzmaBot/1.0 (+https://artinazma.net)"},
        )

        if response.status_code >= 400:
            return None

        return response.text

    except Exception as e:
        print("ArtinAzma fetch failed:", url, e)
        return None


def build_search_queries(message: str) -> List[str]:
    normalized = normalize_text(message)

    queries: List[str] = []

    # مدل‌های انگلیسی / لاتین
    latin_phrases = re.findall(
        r"[A-Za-z][A-Za-z0-9\-]{2,}(?:\s+[A-Za-z0-9\-]{2,})?", message or ""
    )

    for phrase in latin_phrases:
        phrase = phrase.strip()
        if phrase and phrase.lower() not in [q.lower() for q in queries]:
            queries.append(phrase)

    # عبارت فارسی تمیزشده
    words = [
        word
        for word in normalized.split()
        if len(word) >= 3 and word not in STOP_WORDS_FA
    ]

    if words:
        queries.append(" ".join(words[:8]))

    # کل پیام کوتاه‌شده
    if normalized and normalized not in [q.lower() for q in queries]:
        queries.append(normalized[:90])

    # حذف تکراری‌ها
    unique_queries = []
    seen = set()

    for query in queries:
        key = normalize_text(query)
        if key and key not in seen:
            seen.add(key)
            unique_queries.append(query)

    return unique_queries[:2]


def search_wordpress_api(query: str) -> List[Dict]:
    url = f"{ARTINAZMA_BASE_URL}/wp-json/wp/v2/search"

    try:
        response = requests.get(
            url,
            params={
                "search": query,
                "per_page": 10,
            },
            timeout=SEARCH_TIMEOUT,
            headers={"User-Agent": "ArtinAzmaBot/1.0 (+https://artinazma.net)"},
        )

        if response.status_code >= 400:
            return []

        items = response.json()

        results = []

        for item in items:
            item_url = clean_url(item.get("url", ""))

            if item_url and is_artinazma_url(item_url):
                results.append(
                    {
                        "title": item.get("title", ""),
                        "url": item_url,
                    }
                )

        return results

    except Exception as e:
        print("ArtinAzma WP search failed:", e)
        return []


def search_html_page(query: str) -> List[Dict]:
    search_url = f"{ARTINAZMA_BASE_URL}/?s={requests.utils.quote(query)}"
    html = fetch_html(search_url)

    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")

    results = []

    for link in soup.select("a[href]"):
        href = clean_url(urljoin(ARTINAZMA_BASE_URL, link.get("href", "")))
        title = " ".join(link.get_text(" ", strip=True).split())

        if not href or not title:
            continue

        if not is_artinazma_url(href):
            continue

        parsed_path = urlparse(href).path.lower()

        # حذف لینک‌های غیرمحصولی یا تکراری
        if any(
            skip in parsed_path
            for skip in [
                "/tag/",
                "/category/",
                "/author/",
                "/wp-content/",
                "/feed/",
                "/cart",
                "/checkout",
                "/my-account",
            ]
        ):
            continue

        if href.rstrip("/") == ARTINAZMA_BASE_URL.rstrip("/"):
            continue

        results.append(
            {
                "title": title,
                "url": href,
            }
        )

    # حذف تکراری‌ها
    unique = {}
    for item in results:
        unique[item["url"]] = item

    return list(unique.values())[:10]


def extract_page_metadata(url: str) -> Optional[Dict]:
    html = fetch_html(url)

    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    title = ""

    og_title = soup.select_one('meta[property="og:title"]')
    if og_title and og_title.get("content"):
        title = og_title["content"].strip()

    if not title and soup.title:
        title = soup.title.get_text(" ", strip=True)

    description = ""

    meta_desc = soup.select_one('meta[name="description"]')
    if meta_desc and meta_desc.get("content"):
        description = meta_desc["content"].strip()

    og_desc = soup.select_one('meta[property="og:description"]')
    if not description and og_desc and og_desc.get("content"):
        description = og_desc["content"].strip()

    image_url = ""

    image_selectors = [
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
    ]

    for selector in image_selectors:
        meta_image = soup.select_one(selector)
        if meta_image and meta_image.get("content"):
            image_url = urljoin(url, meta_image["content"].strip())
            break

    if not image_url:
        # اگر og:image نبود، اولین تصویر جدی داخل صفحه را بردار
        for img in soup.select(
            "article img[src], main img[src], .entry-content img[src], .product img[src]"
        ):
            src = img.get("src", "").strip()

            if not src:
                continue

            image_url = urljoin(url, src)
            break

    page_text = soup.get_text(" ", strip=True)
    page_text = re.sub(r"\s+", " ", page_text)

    return {
        "title": title,
        "description": description,
        "image_url": image_url,
        "text": page_text[:5000],
    }


def score_candidate(message: str, query: str, candidate: Dict, metadata: Dict) -> int:
    score = 0

    message_norm = normalize_text(message)
    query_norm = normalize_text(query)

    title_norm = normalize_text(
        f"{candidate.get('title', '')} {metadata.get('title', '')}"
    )
    url_norm = normalize_text(candidate.get("url", ""))
    desc_norm = normalize_text(metadata.get("description", ""))
    text_norm = normalize_text(metadata.get("text", ""))

    searchable = f"{title_norm} {url_norm} {desc_norm} {text_norm}"

    if query_norm and query_norm in searchable:
        score += 8

    # عبارت دقیق مدل لاتین امتیاز بالا بگیرد
    latin_phrases = re.findall(
        r"[A-Za-z][A-Za-z0-9\-]{2,}(?:\s+[A-Za-z0-9\-]{2,})?", message or ""
    )

    for phrase in latin_phrases:
        phrase_norm = normalize_text(phrase)
        if phrase_norm and phrase_norm in searchable:
            score += 10

    message_tokens = [
        token
        for token in message_norm.split()
        if len(token) >= 3 and token not in STOP_WORDS_FA
    ]

    for token in message_tokens:
        if token in searchable:
            score += 1

    if metadata.get("image_url"):
        score += 2

    if "artinazma.net" in candidate.get("url", ""):
        score += 3

    return score


def find_artinazma_resources(
    message: str, max_results: int = 2
) -> Dict[str, List[Dict]]:
    if not is_product_or_material_question(message):
        return {
            "links": [],
            "images": [],
            "resources_found": False,
        }

    index_result = search_artinazma_index(message, max_results=max_results)

    if index_result.get("resources_found"):
        return index_result

    index_data = load_index()
    index_items = index_data.get("items", [])

    if index_items:
        return {
            "links": [],
            "images": [],
            "resources_found": False,
        }

    cache_key = normalize_text(message)

    cached = _cache.get(cache_key)
    if cached and time.time() - cached["created_at"] < CACHE_TTL_SECONDS:
        return cached["data"]

    queries = build_search_queries(message)

    candidates: Dict[str, Dict] = {}
    for query in queries:
        for item in search_wordpress_api(query):
            candidates[item["url"]] = {
                **item,
                "query": query,
            }

        for item in search_html_page(query):
            candidates[item["url"]] = {
                **item,
                "query": query,
            }

    scored_items = []

    for candidate in candidates.values():
        metadata = extract_page_metadata(candidate["url"])

        if not metadata:
            continue

        score = score_candidate(
            message=message,
            query=candidate.get("query", ""),
            candidate=candidate,
            metadata=metadata,
        )

        if score < MIN_SCORE:
            continue

        title = (
            metadata.get("title") or candidate.get("title") or "صفحه مرتبط آرتین آزما"
        )
        image_url = metadata.get("image_url", "")

        if image_url and not is_artinazma_url(image_url):
            # طبق قانون شما، عکس هم فقط از سایت آرتین آزما باشد
            image_url = ""

        scored_items.append(
            {
                "title": title,
                "url": candidate["url"],
                "image_url": image_url,
                "description": metadata.get("description", ""),
                "source": "artinazma.net",
                "score": score,
            }
        )

    scored_items.sort(key=lambda item: item["score"], reverse=True)

    selected = scored_items[:max_results]

    links = [
        {
            "title": item["title"],
            "url": item["url"],
            "source": item["source"],
            "score": item["score"],
        }
        for item in selected
    ]

    images = [
        {
            "title": item["title"],
            "url": item["image_url"],
            "page_url": item["url"],
            "source": item["source"],
        }
        for item in selected
        if item.get("image_url")
    ]

    data = {
        "links": links,
        "images": images,
        "resources_found": bool(links),
    }

    _cache[cache_key] = {
        "created_at": time.time(),
        "data": data,
    }

    return data


def append_artinazma_resources_to_answer(answer: str, links: List[Dict]) -> str:
    if not links:
        return answer

    final_answer = (answer or "").strip()

    final_answer += "\n\nصفحه مرتبط در سایت آرتین آزما:"
    for link in links[:2]:
        final_answer += f"\n- [{link['title']}]({link['url']})"

    return final_answer
