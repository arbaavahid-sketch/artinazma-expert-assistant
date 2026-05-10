import json
import os
import re
import time
from typing import Dict, List
from urllib.parse import urlparse, unquote

ARTINAZMA_BASE_URL = "https://artinazma.net"
INDEX_FILE = "artinazma_site_index.json"
MAX_INDEX_PAGES = 1000


SKIP_PATH_PARTS = [
    "/tag/",
    "/category/",
    "/author/",
    "/wp-content/",
    "/feed/",
    "/cart",
    "/checkout",
    "/my-account",
    "/product_cat/",
    "/product_tag/",
]


def normalize_text(text: str) -> str:
    text = text or ""
    text = unquote(text)
    text = text.lower()
    text = re.sub(r"[\u200c\s]+", " ", text)
    text = re.sub(r"[^\w\s\-\u0600-\u06FF]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def should_skip_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        host = parsed.netloc.lower()
        path = parsed.path.lower()

        if host not in ["artinazma.net", "www.artinazma.net"]:
            return True

        if url.rstrip("/") == ARTINAZMA_BASE_URL:
            return True

        return any(skip in path for skip in SKIP_PATH_PARTS)

    except Exception:
        return True


def make_title_from_url(url: str) -> str:
    path = unquote(urlparse(url).path.strip("/"))

    if not path:
        return "صفحه مرتبط آرتین آزما"

    slug = path.split("/")[-1]
    slug = slug.replace("-", " ").replace("_", " ").strip()

    return slug or "صفحه مرتبط آرتین آزما"


def get_local_sitemap_urls() -> List[str]:
    local_files = [
        "product-sitemap.xml",
        "portfolio-sitemap.xml",
        "page-sitemap.xml",
        "post-sitemap.xml",
    ]

    discovered = []

    for file_name in local_files:
        if not os.path.exists(file_name):
            print("Local sitemap not found:", file_name)
            continue

        try:
            with open(file_name, "r", encoding="utf-8") as f:
                xml_text = f.read()
        except UnicodeDecodeError:
            with open(file_name, "r", encoding="utf-8-sig") as f:
                xml_text = f.read()

        urls = re.findall(r"<loc>\s*(.*?)\s*</loc>", xml_text, flags=re.IGNORECASE)

        for url in urls:
            url = url.strip()

            if url and not should_skip_url(url):
                discovered.append(url)

    unique = []
    seen = set()

    for url in discovered:
        clean_url = url.split("#")[0].strip()

        if clean_url not in seen:
            seen.add(clean_url)
            unique.append(clean_url)

    return unique[:MAX_INDEX_PAGES]


def save_index(items: List[Dict]) -> None:
    payload = {
        "created_at": time.time(),
        "base_url": ARTINAZMA_BASE_URL,
        "count": len(items),
        "items": items,
    }

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)


def load_index() -> Dict:
    if not os.path.exists(INDEX_FILE):
        return {
            "created_at": 0,
            "base_url": ARTINAZMA_BASE_URL,
            "items": [],
        }

    try:
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {
            "created_at": 0,
            "base_url": ARTINAZMA_BASE_URL,
            "items": [],
        }


def rebuild_artinazma_index(force: bool = False) -> Dict:
    urls = get_local_sitemap_urls()

    items = []

    for url in urls:
        title = make_title_from_url(url)

        items.append(
            {
                "title": title,
                "url": url,
                "description": "",
                "image_url": "",
                "text": title,
                "normalized": normalize_text(f"{title} {url}"),
            }
        )

    save_index(items)

    return {
        "success": True,
        "message": "ArtinAzma index rebuilt from local sitemap files.",
        "count": len(items),
    }


def search_artinazma_index(query: str, max_results: int = 2) -> Dict[str, List[Dict]]:
    index_data = load_index()
    items = index_data.get("items", [])

    if not items:
        return {
            "links": [],
            "images": [],
            "resources_found": False,
        }

    query_norm = normalize_text(query)

    latin_phrases = re.findall(
        r"[A-Za-z][A-Za-z0-9\-]{2,}(?:\s+[A-Za-z0-9\-]{1,})?", query or ""
    )

    strict_model_tokens = []

    for phrase in latin_phrases:
        parts = [
            normalize_text(part)
            for part in phrase.replace("-", " ").split()
            if len(normalize_text(part)) >= 2
        ]

        if len(parts) >= 2:
            strict_model_tokens = parts
            break

    tokens = [token for token in query_norm.split() if len(token) >= 3]

    scored = []

    for item in items:
        searchable = item.get("normalized", "")
        title_norm = normalize_text(item.get("title", ""))
        url_norm = normalize_text(item.get("url", ""))

        score = 0

        # اگر مدل لاتین دو بخشی مثل Spectroscan SE داریم، همه بخش‌ها باید باشند
        if strict_model_tokens:
            all_parts_exist = all(
                token in title_norm or token in url_norm or token in searchable
                for token in strict_model_tokens
            )

            if not all_parts_exist:
                continue

            score += 50

        if query_norm and query_norm in searchable:
            score += 20

        for phrase in latin_phrases:
            phrase_norm = normalize_text(phrase)

            if phrase_norm and phrase_norm in searchable:
                score += 30

        for token in tokens:
            if token in title_norm:
                score += 5
            elif token in url_norm:
                score += 4
            elif token in searchable:
                score += 1

        if score >= 20:
            scored.append(
                {
                    **item,
                    "score": score,
                }
            )

    scored.sort(key=lambda item: item["score"], reverse=True)

    selected = scored[:max_results]

    links = [
        {
            "title": item.get("title") or "صفحه مرتبط آرتین آزما",
            "url": item.get("url"),
            "source": "artinazma.net",
            "score": item.get("score", 0),
        }
        for item in selected
        if item.get("url")
    ]

    images = [
        {
            "title": item.get("title") or "تصویر محصول",
            "url": item.get("image_url"),
            "page_url": item.get("url"),
            "source": "artinazma.net",
        }
        for item in selected
        if item.get("image_url")
    ]

    return {
        "links": links,
        "images": images,
        "resources_found": bool(links),
    }
