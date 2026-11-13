"""Catalog-only retrieval for "which device / product should I use" questions.

ASTM full text is ~88 % of the knowledge base, so in a plain search the
brochures and catalogs of the brands ArtinAzma supplies rank below the
standards that describe the same test, and recommendation answers end up
naming a device type but never a model the company sells. This searches only
the catalog categories and returns a few distinct files to reserve slots for in
the chat context.
"""
import logging
import re
from concurrent.futures import ThreadPoolExecutor

from knowledge_service import search_knowledge_base
from utils.chat_utils import _VECTOR_RELEVANT_THRESHOLD, vector_relevance

logger = logging.getLogger("catalog_retrieval")

# Knowledge-base categories holding supplier brochures, catalogs and product sheets.
CATALOG_CATEGORIES = ("equipment", "products")
CATALOG_SLOTS = 3

# A device word together with asking for one. Intent alone is too coarse: it puts
# "what is API gravity" and "TAN vs TBN" next to real device requests, and files
# "what device do you have for grain protein" under lab analysis.
_DEVICE = re.compile(
    r"دستگاه|تجهیز|آنالایزر|آنالیزور|تیتراتور|اسپکتروفتومتر|ویسکومتر|کروماتوگراف|حمام|"
    r"\b(?:device|instrument|analy[sz]er|equipment|apparatus|tester|titrator|spectrophotometer|viscometer|bath)s?\b",
    re.I)
_ASKING = re.compile(
    r"پیشنهاد|معرفی|مناسب|دارید|دارین|می\s*خوا[هم]|میخوا[هم]|لازم دارم|نیاز دارم|بخرم|انتخاب|کدام|کدوم|"
    r"چه\s+(?:دستگاه|تجهیز|آنالایزر)|خوبه|بهتره|"
    r"\b(?:recommend|suggest|need|want|which|best|suitable|looking for)\b",
    re.I)


def is_device_request(message):
    """True when the user is asking which device or instrument to use or buy."""
    text = str(message or "").replace("‌", " ")
    return bool(_DEVICE.search(text) and _ASKING.search(text))

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="catalog")


def _search(query):
    try:
        return search_knowledge_base(query, top_k=8, category_filter=CATALOG_CATEGORIES)
    except Exception as e:  # noqa: BLE001 — retrieval must never break a chat answer
        logger.warning("Catalog search failed: %s", e)
        return []


def find_catalog_docs(message, english_query=None, limit=CATALOG_SLOTS):
    """Up to `limit` relevant catalog chunks, one per file, best first.

    Both the question and its English translation are searched (in parallel):
    most brochures are English, so a Persian question alone matches them weakly.
    """
    queries = [q for q in (message, english_query) if q]
    hits = [d for docs in _executor.map(_search, queries) for d in docs]
    hits = [d for d in hits if vector_relevance(d) >= _VECTOR_RELEVANT_THRESHOLD]
    hits.sort(key=vector_relevance, reverse=True)
    picked, files = [], set()
    for doc in hits:
        name = doc.get("file_name", "")
        if name in files:
            continue  # one chunk per brochure, so several brands/models get a slot
        files.add(name)
        picked.append({**doc, "catalog_match": True})
        if len(picked) == limit:
            break
    return picked


def merge_catalog_docs(related_docs, catalog_docs, max_docs=8):
    """Keep the top general sources, then the catalog matches, then the rest, within max_docs."""
    def key(d):
        return d.get("file_name", ""), (d.get("content", "") or "")[:80]

    catalog_docs = catalog_docs[:max_docs]
    catalog_keys = {key(d) for d in catalog_docs}
    others = [d for d in related_docs if key(d) not in catalog_keys]
    head = min(3, max_docs - len(catalog_docs))
    return (others[:head] + catalog_docs + others[head:])[:max_docs]


CATALOG_INSTRUCTIONS = (
    "قواعد پیشنهاد دستگاه یا محصول:\n"
    "- منابع داخلی با دسته‌بندی equipment یا products بروشور و کاتالوگ برندهایی است که آرتین آزما عرضه می‌کند.\n"
    "- اگر در این منابع مدلی هست که با کاربرد، نمونه و استاندارد سؤال جور است، آن را با نام دقیق برند و مدل "
    "به‌عنوان گزینهٔ پیشنهادی معرفی کن و بگو چرا مناسب است (استاندارد، محدوده، اتوماسیون).\n"
    "- فقط مدل‌هایی را نام ببر که در همین منابع آمده‌اند؛ انطباق با یک استاندارد را فقط وقتی بنویس که در همان منبع آمده باشد.\n"
    "- اگر هیچ مدل مناسبی در منابع نیست، مدل نساز: دستهٔ دستگاه، مشخصات لازم و استاندارد را بگو و برای "
    "انتخاب مدل به کارشناسان آرتین آزما ارجاع بده.\n"
    "- قیمت، موجودی یا زمان تحویل را حدس نزن."
)
