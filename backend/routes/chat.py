import re
import os
import json as _json_local
import logging
import time as _time
from contextlib import contextmanager
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from schemas.models import ChatRequest, SuggestQuestionsRequest
from utils.deps import limiter
from utils.chat_utils import (
    make_response_cache,
    _ASTM_KNOWN_STANDARDS,
    _LOCAL_SCORE_THRESHOLD,
    _MODEL_LOCAL_SCORE_THRESHOLD,
    _WEAK_CONTEXT_THRESHOLD,
    _VECTOR_RELEVANT_THRESHOLD,
    _VECTOR_STRONG_THRESHOLD,
    _TECHNICAL_INTENTS,
    vector_relevance,
    is_specific_product_or_model_question,
    context_has_exact_model_match,
    is_artinazma_related_question,
    is_followup_transform_request,
)

from intent_service import detect_question_intent
from astm_link_service import (
    official_astm_url,
    build_official_links,
    seed_valid,
    extract_astm_codes,
    astm_link_tail,
)
from local_search_service import local_search_knowledge_base, build_local_answer
from knowledge_service import search_knowledge_base
from site_resource_service import find_artinazma_resources
from web_search_service import (
    search_web_sources,
    build_web_context,
    is_web_search_configured,
)
from ai_service import (
    ask_expert_assistant,
    ask_expert_assistant_stream,
    detect_user_language,
    translate_query_for_search,
    ENABLE_OPENAI_WEB_SEARCH,
    ENABLE_DEEP_RESEARCH,
)
from deep_search_limits import allow_deep_search
from db_service import (
    save_expert_question,
    save_user_memory,
    detect_domain,
    get_customer_cross_session_context,
    get_customer_by_id,
)
from metrics_service import (
    chat_requests_total,
    chat_requests_by_intent,
    cache_hits,
    cache_misses,
    ai_response_duration,
)

logger = logging.getLogger("artin_scheduler")

router = APIRouter()

_response_cache = make_response_cache(maxsize=200, ttl=3600)
_COMMERCIAL_INTENTS = {"commercial_request"}

# کدهای دیکشنری داخلی را از پیش «معتبر» علامت بزن تا برایشان بررسی شبکه لازم نشود.
seed_valid(_ASTM_KNOWN_STANDARDS)

# Executor مشترک برای کارهای پس‌زمینه‌ی پایپلاین (فعلاً فقط ترجمهٔ سؤال). ترجمه یک
# فراخوانِ LLM ~۲ ثانیه‌ای است؛ اجرای هم‌زمانِ آن با intent/جست‌وجوها «زمان تا اولین
# کلمه» را کم می‌کند. یک executorِ پروسه‌ای (نه per-request) تا نشتِ ترد نداشته باشیم.
_bg_executor = ThreadPoolExecutor(max_workers=8, thread_name_prefix="chat-bg")


@contextmanager
def _stage(timings: dict, label: str):
    """زمان‌سنجِ سبکِ هر مرحلهٔ پایپ‌لاین (بر حسب میلی‌ثانیه). بدون تغییر رفتار؛
    فقط برای دیدن اینکه تأخیر واقعاً کجاست (translate، Qdrant، وب، ...)."""
    _t = _time.perf_counter()
    try:
        yield
    finally:
        timings[label] = round((_time.perf_counter() - _t) * 1000, 1)


def _build_chat_pipeline(body: ChatRequest, client_ip: str = "") -> dict:
    """
    Shared pre-processing pipeline for /chat and /chat/stream.
    Returns a dict with all computed fields needed by both endpoints.
    """
    # کدهای ASTM هر سری (A/B/C/D/E/F/G…) — سری‌های غیر-D فقط با پیشوند «ASTM».
    _astm_codes = extract_astm_codes(body.message)
    has_astm_code = bool(_astm_codes)
    specific_model_question = is_specific_product_or_model_question(body.message)
    allow_company_reference = is_artinazma_related_question(body.message)
    is_transform_followup = is_followup_transform_request(body.message)
    _timings: dict = {}
    _pipeline_t0 = _time.perf_counter()

    # ترجمهٔ سؤال فارسی→انگلیسی (برای جست‌وجوی بین‌زبانی) بزرگ‌ترین سهمِ تأخیرِ «تا اولین
    # کلمه» است (~۳ ثانیه، یک فراخوانِ LLM). آن را همین‌جا زودهنگام و موازی با intent و
    # جست‌وجوها کیک می‌زنیم؛ نتیجه در مرحلهٔ vector_xling برداشت می‌شود. شرطِ کیک‌زدن دقیقاً
    # همان شرطِ ورود به شاخهٔ بازیابیِ ترکیبی است تا فراخوانِ هدررفته نداشته باشیم.
    _translate_future = None
    if (
        not (specific_model_question and not has_astm_code)
        and detect_user_language(body.message) == "fa"
    ):
        _translate_future = _bg_executor.submit(translate_query_for_search, body.message)

    with _stage(_timings, "intent"):
        intent_data = detect_question_intent(message=body.message, domain=body.domain or "auto")

    question_intent: str = intent_data["intent"]
    question_intent_label: str = intent_data["label"]
    with _stage(_timings, "local_search"):
        local_docs = local_search_knowledge_base(body.message, top_k=12)

    best_score = 0.0
    related_docs: list = []
    search_mode = "unknown"

    # ── استخراج عنوان + لینک رسمی استاندارد ASTM ──
    # لینک رسمی ASTM قطعی و از روی کد ساختنی است: store.astm.org/standards/d<شماره>.
    # آن را خودمان تزریق می‌کنیم چون مدل (حتی با وب روشن) URL را با الگوی غلط می‌سازد
    # (مثلاً www.astm.org/d0086 به‌جای store.astm.org/standards/d86).
    # کدهای دیکشنری داخلی عنوانِ معتبر هم می‌گیرند؛ بقیهٔ کدهای ASTM فقط لینک (با
    # اعتبارسنجی ۴۰۴) — تا کل استانداردهای ASTM پوشش داده شوند، نه فقط دیکشنری.
    _astm_inject: str = ""
    _astm_link_inject: str = ""
    if has_astm_code:
        _known_codes = [c for c in _astm_codes if c in _ASTM_KNOWN_STANDARDS]
        if _known_codes:
            _lines = [
                f"• {_ASTM_KNOWN_STANDARDS[code]}\n"
                f"  لینک رسمی (خرید/مشاهده): {official_astm_url(code)}"
                for code in _known_codes
            ]
            _astm_inject = (
                "اطلاعات دقیق استاندارد (از پایگاه دانش داخلی):\n"
                + "\n".join(_lines)
                + "\n⚠️ قانون مطلق: دقیقاً همین استاندارد(ها) را توضیح بده و هرگز کد را با کد دیگری جایگزین نکن."
                + "\n⚠️ اگر کاربر لینک/آدرس/دانلود استاندارد را خواست: مستقیم، کوتاه و با اطمینان"
                " همین «لینک رسمی» بالا را بده و هرگز URL دیگری از خودت نساز یا حدس نزن."
                + "\n⚠️ هرگز ننویس که استاندارد «حق نشر/کپی‌رایت» دارد یا «نمی‌توانی/امکان ندارد لینک بدهی»،"
                " و هرگز کاربر را به «جست‌وجو در astm.org»، «site:astm.org»، «سرچ کن» یا «به سایت ASTM برو"
                " و جست‌وجو کن» ارجاع نده — لینک رسمی را داری، پس فقط و کوتاه همان را ارائه کن."
            )
        # درخواست لینک برای کدهای خارج از دیکشنری: لینک قطعی با اعتبارسنجی ۴۰۴.
        _unknown_codes = [c for c in _astm_codes if c not in _ASTM_KNOWN_STANDARDS]
        _asks_for_source = bool(
            re.search(r"لینک|link|url|آدرس|دانلود|download|خرید|بخرم|تهیه|بگیرم",
                      body.message, flags=re.IGNORECASE)
        )
        if _asks_for_source and _unknown_codes:
            _astm_link_inject = build_official_links(
                _unknown_codes, set(_ASTM_KNOWN_STANDARDS)
            )

    _local_best = float(local_docs[0].get("score", 0) or 0) if local_docs else 0.0
    _vector_best = 0.0

    # سؤال دارای کد ASTM هم از مسیر بازیابیِ ترکیبی می‌گذرد تا از متنِ کاملِ استانداردهای
    # آپلودشده در بانک دانش (Qdrant) استفاده کند، نه فقط عنوانِ یک‌خطیِ دیکشنری. لنگرِ
    # عنوانِ معتبر (_astm_inject) و خاموش‌بودنِ وب برای کدهای شناخته‌شده دست‌نخورده می‌ماند،
    # پس کدِ شناخته‌شده هم لنگرِ معتبر می‌گیرد هم متنِ واقعیِ PDF، و پاسخ پایدار می‌ماند
    # (بازیابیِ KB قطعی است؛ فقط وب نویز اضافه می‌کرد که همچنان خاموش است).
    if specific_model_question and not has_astm_code:
        exact_local_match = context_has_exact_model_match(body.message, local_docs)
        if (
            exact_local_match
            and local_docs
            and _local_best >= _MODEL_LOCAL_SCORE_THRESHOLD
        ):
            related_docs = local_docs[:8]
            search_mode = "local_exact_model"
        else:
            related_docs = []
            search_mode = "no_exact_model_context"
    else:
        # ── بازیابی ترکیبی (hybrid: کلیدواژه‌ای + معنایی) ──
        # جست‌وجوی کلیدواژه‌ای فقط هم‌زبان را خوب پیدا می‌کند؛ بیشترِ اسناد انگلیسی‌اند
        # و سؤال‌ها فارسی. جست‌وجوی معنایی (embedding) بین‌زبانی است، پس همیشه هر دو
        # اجرا و ادغام می‌شوند تا سندِ انگلیسیِ مرتبط پشتِ تطبیقِ کلیدواژه‌ایِ فارسی نماند.
        def _relevant_sorted(docs: list) -> list:
            hits = [d for d in docs if vector_relevance(d) >= _VECTOR_RELEVANT_THRESHOLD]
            return sorted(hits, key=vector_relevance, reverse=True)

        try:
            with _stage(_timings, "vector_direct"):
                _direct_hits = _relevant_sorted(search_knowledge_base(body.message, top_k=10))
        except Exception as e:
            logger.warning("AI vector search failed: %s", e)
            _direct_hits = []

        # سؤال فارسی + اسناد انگلیسی: جست‌وجوی معناییِ مستقیم می‌بازد چون chunkهای
        # فارسیِ هم‌موضوع (کسینوس ~0.5) همیشه بالاتر از تطبیق بین‌زبانی (~0.25)
        # می‌نشینند. پس جست‌وجوی دوم با ترجمهٔ انگلیسیِ سؤال، اسناد انگلیسی را هم‌مقیاس
        # می‌کند. این نتایج «جای رزرو» می‌گیرند تا پشتِ سندهای فارسی از سقف نیفتند.
        # خطا/نبود ترجمه → بی‌سروصدا صرف‌نظر.
        _xling_hits: list = []
        if _translate_future is not None:
            # ترجمه از قبل (موازی) شروع شده؛ اینجا فقط منتظرِ اتمامش می‌مانیم —
            # که معمولاً تا این نقطه تمام یا نزدیک‌به‌تمام است.
            with _stage(_timings, "translate_query"):
                _q_en = _translate_future.result()
            if _q_en:
                try:
                    with _stage(_timings, "vector_xling"):
                        _xling_hits = _relevant_sorted(search_knowledge_base(_q_en, top_k=8))
                except Exception as e:
                    logger.warning("EN cross-lingual search failed: %s", e)

        _vector_best = max(
            (vector_relevance(d) for d in _direct_hits + _xling_hits), default=0.0
        )
        _local_hits = local_docs[:5] if _local_best >= _LOCAL_SCORE_THRESHOLD else []

        def _doc_key(d: dict):
            return (d.get("file_name", ""), (d.get("content", "") or "")[:80])

        # ادغام با جای‌گذاری تضمین‌شده: اگر کلیدواژه‌ای قوی است اول همان، بعد ۲ جای
        # رزرو برای نتایج بین‌زبانی (که هدف اصلی‌اند و به‌سختی به‌دست می‌آیند)، بعد
        # بقیهٔ معنایی مستقیم، و در آخر باقیمانده‌ها.
        _kw_first = _local_best >= _WEAK_CONTEXT_THRESHOLD
        _order = (
            (_local_hits[:3] if _kw_first else _direct_hits[:3])
            + _xling_hits[:2]
            + (_direct_hits if _kw_first else _local_hits)
            + (_local_hits if _kw_first else _direct_hits)
            + _xling_hits[2:]
        )
        _seen: set = set()
        related_docs = []
        for d in _order:
            k = _doc_key(d)
            if k in _seen:
                continue
            _seen.add(k)
            related_docs.append(d)
        related_docs = related_docs[:8]

        _has_vector = bool(_direct_hits or _xling_hits)
        if _local_hits and _has_vector:
            search_mode = "hybrid" + ("+xling" if _xling_hits else "")
        elif _has_vector:
            search_mode = "ai_vector" + ("+xling" if _xling_hits else "")
        elif _local_hits:
            search_mode = "local_fast"
        else:
            search_mode = "no_internal_match"

    if related_docs:
        try:
            best_score = float(related_docs[0].get("score", 0) or 0)
        except Exception:
            best_score = 0.0

    # ضعف context باید scale-aware باشد: کلیدواژه‌ای (0-100) و معنایی (کسینوس 0-1)
    # مقیاس متفاوتی دارند؛ یک تطبیق معناییِ خوب نباید به‌خاطر مقیاسِ کوچکش دور ریخته شود.
    _context_is_weak = (
        _local_best < _WEAK_CONTEXT_THRESHOLD
        and _vector_best < _VECTOR_RELEVANT_THRESHOLD
    )

    if question_intent in _TECHNICAL_INTENTS and related_docs and _context_is_weak:
        related_docs = []
        best_score = 0.0
        search_mode = f"{search_mode}+ignored_weak_internal_context"

    # ── Site resource lookup ──
    resource_links: list = []
    resource_images: list = []
    artinazma_context = _astm_inject

    if allow_company_reference:
        try:
            with _stage(_timings, "site_lookup"):
                artinazma_resources = find_artinazma_resources(message=body.message, max_results=2)
            resource_links = artinazma_resources.get("links", [])
            resource_images = artinazma_resources.get("images", [])
            if resource_links:
                artinazma_context = (
                    "نتیجه جست‌وجوی سایت رسمی آرتین آزما:\n"
                    "این مورد در سایت رسمی آرتین آزما پیدا شده است.\n"
                    "هنگام پاسخ، کامل و فنی توضیح بده.\n"
                    "در متن پاسخ، لینک خام ننویس؛ لینک جداگانه توسط سیستم نمایش داده می‌شود.\n"
                )
                for link in resource_links:
                    artinazma_context += f"\nعنوان صفحه: {link.get('title', '')}"
                    artinazma_context += f"\nلینک صفحه: {link.get('url', '')}\n"
                search_mode = f"{search_mode}+artinazma_site"
        except Exception as e:
            logger.warning("ArtinAzma resource search failed: %s", e)

    # لینک رسمی ASTM برای کدهای خارج از دیکشنری (جدا از منطق شرکت تا بازنویسی نشود)
    if _astm_link_inject:
        artinazma_context = f"{artinazma_context}\n\n{_astm_link_inject}".strip()

    # ── Web search flag ──
    allow_web_search = True
    if body.response_mode == "brief":
        allow_web_search = False
    if question_intent in _TECHNICAL_INTENTS:
        allow_web_search = True
    if specific_model_question or has_astm_code or not related_docs:
        allow_web_search = True
    # وقتی عنوان دقیق استاندارد از دیکشنری داخلی تزریق شده، پاسخ یک لنگر معتبر و
    # ثابت دارد. در این حالت وب‌سرچ فقط نویز و ناپایداری اضافه می‌کند (پاسخ به یک
    # سؤال یکسان بین اجراها فرق می‌کرد و گاهی از موضوع منحرف می‌شد)، پس خاموشش کن.
    # لینک رسمی هم به‌صورت قطعی تزریق می‌شود (store.astm.org/standards/d<کد>)، پس حتی
    # برای درخواست لینک هم نیازی به وب نیست — وب فقط URL غلط تولید می‌کرد. این برای
    # کدهای خارج از دیکشنری هم صدق می‌کند (لینک قطعی + اعتبارسنجی ۴۰۴).
    if _astm_inject or _astm_link_inject:
        allow_web_search = False
    if question_intent in _COMMERCIAL_INTENTS:
        allow_web_search = False
    if is_transform_followup:
        allow_web_search = False
        related_docs = []
        search_mode = "followup_transform"

    if allow_web_search:
        search_mode = f"{search_mode}+openai_web"

    # ── Build context string ──
    context_parts = []
    for doc in related_docs:
        context_parts.append(
            f"منبع داخلی:\nعنوان: {doc.get('title', '')}\n"
            f"فایل: {doc.get('file_name', '')}\n"
            f"دسته‌بندی: {doc.get('category', '')}\n"
            f"امتیاز ارتباط: {doc.get('score', '')}\n"
            f"متن:\n{doc.get('content', '')}"
        )
    context = "\n\n".join(context_parts)

    if artinazma_context:
        context = f"{context}\n\n{artinazma_context}".strip()

    if body.context:
        context = f"اطلاعات خارجی ارائه‌شده توسط کاربر:\n{body.context}\n\n---\n\n{context}".strip()

    # ── وب‌سرچ واقعی (Tavily) ──
    # وقتی وب مجاز است، برای سؤال‌های استاندارد (ISO/ASTM/EN/…)، محصول/مدل، یا وقتی
    # بازیابی داخلی خالی است، منابع زندهٔ وب را می‌آوریم تا مدل به‌جای حدس از حافظه بر
    # داده تکیه کند. برای سؤال استاندارد، تطبیقِ ضعیفِ داخلی معمولاً گمراه‌کننده است،
    # پس منبع وب را مبنای اصلی می‌گذاریم. اگر Tavily پیکربندی نشده/خطا داد، بی‌سروصدا
    # صرف‌نظر می‌شود و رفتار قبلی حفظ می‌ماند (fallback امن).
    _is_standard_query = bool(
        re.search(r"\b(ISO|ASTM|EN|IP|DIN|GOST|IEC|API|ISIRI|JIS|BS|EPA|UOP|NACE)\b",
                  body.message, flags=re.IGNORECASE)
    )
    # کدِ محصول/پارت‌نامبر/مدل (توکنِ لاتینِ ۵+ کاراکتری که هم حرف و هم عدد دارد،
    # مثل ZSQ240R0TK، ZR0Q00800، RA-915M، Direct8). وجودِ چنین کدی یعنی سؤالِ
    # محصولی/بازاری است و اطلاعاتِ زندهٔ وب (اسپک، قیمت، وضعیت منسوخ) واقعاً مهم است.
    _has_product_code = bool(
        re.search(r"\b(?=[A-Za-z0-9\-]*[A-Za-z])(?=[A-Za-z0-9\-]*\d)[A-Za-z][A-Za-z0-9\-]{4,}\b",
                  body.message)
    )
    # سیگنالِ اینکه اطلاعاتِ زندهٔ وب برای سؤال مهم است (استاندارد، محصول/مدل/کد،
    # بدونِ منبعِ داخلی، یا تطبیقِ داخلیِ ضعیف).
    _web_signals = bool(
        _is_standard_query
        or specific_model_question
        or _has_product_code
        or not related_docs
        or (
            _local_best < _WEAK_CONTEXT_THRESHOLD
            and _vector_best < _VECTOR_STRONG_THRESHOLD
        )
    )
    # واجدِ شرایطِ deep-research. عمداً به allow_web_search وابسته نیست: سؤال‌های
    # «تجاری/قیمت» که allow_web را خاموش می‌کردند، دقیقاً همان‌هایی‌اند که به وبِ
    # زندهٔ عمیق (اسپک، وضعیت تولید، جایگزین) نیاز دارند. فقط در حالت‌هایی که وب
    # واقعاً بی‌معنی است کنار می‌رود: خلاصه‌سازیِ follow-up، کدِ ASTMِ قطعی، حالت brief.
    _web_eligible = bool(
        _web_signals
        and not is_transform_followup
        and not (_astm_inject or _astm_link_inject)
        and body.response_mode != "brief"
    )
    # ── سقفِ هزینه‌ی جست‌وجوی عمیق ──
    # deep-research گران است، پس با سقفِ پلکانی (ناشناس/مشتری) + فیوزِ کلیِ روزانه
    # کنترل می‌شود. اگر سؤال واجدِ شرایط باشد ولی سقف پر شده باشد، به مسیرِ ارزان‌تر
    # (Tavily + مدلِ استاندارد) برمی‌گردد؛ کاربر بازهم جوابِ وب‌محور می‌گیرد.
    _deep_allowed = bool(
        _web_eligible
        and ENABLE_DEEP_RESEARCH
        and allow_deep_search(client_ip=client_ip, customer_id=body.customer_id)
    )
    use_live_web = _deep_allowed
    if use_live_web:
        # deep research دارد اجرا می‌شود؛ پرچمِ وب را هم‌راستا کن (متادیتا + پرامپت).
        allow_web_search = True

    # وقتی جست‌وجوی عمیقِ خودِ مدل اجرا می‌شود، اسنیپت‌های Tavily را تزریق نکن —
    # آن‌ها مدل را به «فقط بر پایهٔ همین snippetها» محدود می‌کنند. Tavily فقط وقتی
    # به‌کار می‌رود که deep-research اجرا نشود (خاموش یا سقف پر شده) — به‌عنوانِ
    # وبِ ارزانِ فالبک.
    if _web_eligible and is_web_search_configured() and not use_live_web:
        try:
            with _stage(_timings, "web_search"):
                _web_results = search_web_sources(body.message, max_results=5)
        except Exception as e:  # noqa: BLE001
            logger.warning("web search failed: %s", e)
            _web_results = []
        if _web_results:
            _web_block = (
                "=== نتایج جست‌وجوی وب (منابع بیرونیِ زنده و معتبر) ===\n"
                "پاسخ را دقیقاً بر پایهٔ همین منابع بده؛ اگر با حافظه‌ات تعارض داشت، منابع وب "
                "ارجح‌اند و از حدسِ حافظه‌ای یا انکار پرهیز کن.\n"
                f"{build_web_context(_web_results)}"
            )
            if _is_standard_query:
                # برای استاندارد، منبع وب معتبرتر از تطبیقِ ضعیفِ داخلی است.
                context = (f"{_web_block}\n\n{context}".strip() if context else _web_block)
            else:
                context = (f"{context}\n\n{_web_block}".strip() if context else _web_block)
            search_mode = f"{search_mode}+tavily"

    # ── Domain detection ──
    auto_domain = detect_domain(body.message)
    selected_domain = body.domain or "auto"
    detected_domain = auto_domain if selected_domain == "auto" else selected_domain

    # ── History (last 6 turns) ──
    history = [
        {"role": item.role, "content": item.content}
        for item in (body.history or [])[-6:]
        if item.role in ["user", "assistant"] and item.content
    ]

    # ── Style instructions ──
    style_instructions = (
        "سبک پاسخ:\n"
        "پاسخ باید شبیه ChatGPT Plus باشد: کامل، دقیق، آموزشی، تیتردار، مرتب، با جدول فقط در صورت نیاز، مثال و جمع‌بندی.\n"
        "قالب خوانایی موبایل:\n"
        "- اول یک نتیجه یا هشدار کاربردی ۲ تا ۳ جمله‌ای بده، بعد وارد جزئیات شو.\n"
        "- از Markdown واقعی استفاده کن: ## برای بخش‌های اصلی، ### برای زیربخش‌ها، لیست شماره‌دار برای مراحل و بولت برای نکات.\n"
        "- از خط جداکننده تزئینی، تیترهای کشیده با ـــــ، و پاراگراف‌های خیلی بلند استفاده نکن.\n"
        "- هر پاراگراف را حداکثر ۲ تا ۳ خط نگه دار و بین بخش‌ها فضای تنفسی بگذار.\n"
        "- متن فارسی را روان و راست‌به‌چپ بنویس؛ کد استاندارد، فرمول، واحد و نام انگلیسی را کوتاه و داخل همان جمله نگه دار.\n"
        "قانون پاسخ تأییدشده: برای سؤال‌های تخصصی و فنی، از منبع معتبر استفاده کن.\n"
        "پاسخ فارسی باشد."
    )
    if question_intent in _COMMERCIAL_INTENTS:
        style_instructions += (
            "\nقواعد درخواست تجاری:\n"
            "- قیمت، موجودی، زمان تحویل یا پیش‌فاکتور را حدس نزن.\n"
            "- برای استعلام دقیق، حتماً مدل، برند/سازنده، کاربرد، نوع نمونه یا ماده، محدوده کاری، تعداد/مقدار و اطلاعات تماس را بخواه.\n"
            "- اگر منبع یا کانتکست معتبر تماس در همین درخواست وجود ندارد، ایمیل، شماره تلفن یا آدرس دقیق را در متن جواب ننویس؛ کاربر را به فرم درخواست یا اطلاعات تماس رسمی سایت ارجاع بده.\n"
            "- پاسخ کوتاه، حرفه‌ای و قابل ارسال به مشتری باشد."
        )
    style_instructions += "\n\n" + """
Laboratory answer contract:
- Correctness has priority over style. Before giving a procedure, standard method, reagent preparation, instrument capability, formula, concentration, or safety instruction, check that the method, analyte, matrix, reagent, and standard code match each other.
- Never substitute one ASTM/ISO/EPA code, reagent, technique, or titrant for another. If a value is version-specific or not certain from context, say it needs verification in the current official method instead of guessing.
- For technical, standard-method, SOP, reagent-preparation, troubleshooting, and QC questions, answer like a senior QC laboratory expert: direct conclusion first, then clear Markdown sections.
- Prefer this mobile-readable shape when relevant: short practical conclusion, purpose/scope, key concentration/range, required materials, numbered step-by-step procedure, calculation/example, critical ASTM/QC points, safety/storage, common mistakes, and a very short practical summary.
- Use headings such as "## هدف و دامنه", "## تجهیزات و مواد", "## روش اجرا", "## محاسبه", "## نکات QC و ایمنی", and "## جمع‌بندی کوتاه" when they match the question. Do not create decorative underline headings.
- Do not give only disclaimers or generic theory. If exact official wording or a version-specific value is uncertain, say that briefly, then still provide the best practical, standard-aware guidance and tell the user to verify the current official standard for regulated work.
- Do not end with salesy follow-up offers unless the user asks for buying, quote, SOP, comparison, or customer-facing text.
- ASTM D3227 guardrail: this is mercaptan sulfur in liquid hydrocarbons by potentiometric titration. If the user asks for the titrant/reagent preparation, do not describe it as a NaOH titrant. The expected practical answer is alcoholic silver nitrate (AgNO3) titrant: dissolve calculated AgNO3 in a small amount of DI water, commonly about 80 mL for a 1 L preparation, dilute to volume with propanol/isopropanol, store protected from light in an amber bottle, and standardize before use.
""".strip()

    if question_intent == "product_or_device":
        style_instructions += (
            "\nقواعد محصول، دستگاه یا آزمون مشخص:\n"
            "- شرایط عددی آزمون مثل دما، زمان، دبی، فشار، حد پذیرش، LOD/LOQ یا rating را فقط وقتی بنویس که در منبع/کانتکست برگشتی آمده باشد.\n"
            "- اگر عدد دقیق لازم است ولی در منبع موجود نیست، به‌جای عددسازی بگو باید آخرین نسخه استاندارد یا دیتاشیت رسمی بررسی شود.\n"
            "- کاربرد، اصل روش، خروجی‌های آزمون و محدودیت‌ها را توضیح بده، اما مشخصات عددی بی‌منبع نساز."
        )
    if is_transform_followup:
        if history:
            style_instructions = (
                "قانون بسیار مهم برای درخواست‌های بازنویسی:\n"
                "پیام فعلی کاربر یک درخواست بازنویسی است. از history استفاده کن.\n"
                "web search انجام نده. اطلاعات جدید اضافه نکن.\n"
                "اگر کاربر خواست «تبدیل به جدول»: فقط Markdown table معتبر تولید کن.\n"
                "از tab یا <br> داخل جدول استفاده نکن. هر ردیف تعداد ستون برابر داشته باشد."
            )
        else:
            # درخواست بازنویسی («جدول کن/خلاصه کن») بدون هیچ متن قبلی: چیزی برای تبدیل
            # وجود ندارد. نباید محتوای جدید و بی‌ربط ساخته شود؛ باید کوتاه و مؤدبانه
            # بپرسد کدام مطلب را تبدیل کند.
            style_instructions = (
                "قانون بسیار مهم:\n"
                "پیام کاربر یک درخواست بازنویسی/تبدیل است (مثل «جدول کن» یا «خلاصه کن»)، "
                "اما هیچ متن یا پاسخ قبلی برای تبدیل وجود ندارد.\n"
                "محتوای جدید نساز و موضوعی از خودت انتخاب نکن. فقط در یک یا دو جملهٔ کوتاه و "
                "مؤدبانه بپرس که کدام متن یا کدام پاسخ را می‌خواهد به جدول/خلاصه تبدیل کنی، "
                "و از او بخواه همان متن را بفرستد. web search هم انجام نده."
            )

    context = f"{context}\n\n---\n\n{style_instructions}".strip() if context else style_instructions

    # ── Sources list ──
    sources = []
    for index, doc in enumerate(related_docs, start=1):
        content = str(doc.get("content", "") or "")
        sources.append(
            {
                "citation_id": f"S{index}",
                "title": doc.get("title", ""),
                "file_name": doc.get("file_name", ""),
                "category": doc.get("category", ""),
                "chunk_index": doc.get("chunk_index", 0),
                "score": float(doc.get("score", 0) or 0),
                "score_reason": doc.get("score_reason", ""),
                "excerpt": content[:260],
            }
        )
    if allow_company_reference:
        sources.append(
            {
                "citation_id": f"S{len(sources) + 1}",
                "title": "ArtinAzma company profile",
                "file_name": "system_company_profile",
                "category": "company_contact",
                "chunk_index": 0,
                "score": 1.0,
                "score_reason": "Company identity and contact information from the configured system profile.",
                "excerpt": (
                    "آرتین آزما مهر تامین‌کننده تجهیزات آزمایشگاهی و آنالیتیکال، مواد "
                    "شیمیایی و مواد فرایندی است. ایمیل رسمی: info@artinazma.net. "
                    "تلفن: 02191008898. واتساپ پشتیبانی: 09906060910."
                ),
            }
        )

    # ── Customer cross-session context ──
    customer_context = ""
    customer_name = ""
    customer_email = ""
    if body.customer_id:
        try:
            customer_context = get_customer_cross_session_context(body.customer_id)
            if not body.user_id or body.user_id == "anonymous":
                body.user_id = f"customer_{body.customer_id}"
        except Exception as _e:
            logger.warning("customer_context load failed: %s", _e)
        # نام/ایمیلِ مشتری برای نمایشِ «پرسنده» در پنلِ سوالاتِ ادمین (snapshot).
        try:
            _cust = get_customer_by_id(body.customer_id)
            if _cust:
                customer_name = _cust.get("full_name") or ""
                customer_email = _cust.get("email") or ""
        except Exception as _e:
            logger.warning("customer lookup for metadata failed: %s", _e)

    _timings["pipeline_total"] = round((_time.perf_counter() - _pipeline_t0) * 1000, 1)
    logger.info(
        "chat pipeline timings (ms): %s | mode=%s web=%s",
        ", ".join(f"{k}={v}" for k, v in _timings.items()),
        search_mode,
        allow_web_search,
    )

    return {
        "has_astm_code": has_astm_code,
        "specific_model_question": specific_model_question,
        "stage_timings_ms": _timings,
        "allow_company_reference": allow_company_reference,
        "is_transform_followup": is_transform_followup,
        "question_intent": question_intent,
        "question_intent_label": question_intent_label,
        "related_docs": related_docs,
        "best_score": best_score,
        "search_mode": search_mode,
        "allow_web_search": allow_web_search,
        "use_live_web": use_live_web,
        "context": context,
        "detected_domain": detected_domain,
        "history": history,
        "sources": sources,
        "resource_links": resource_links,
        "resource_images": resource_images,
        "customer_context": customer_context,
        "user_id": body.user_id or "anonymous",
        "customer_id": body.customer_id,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "response_mode": body.response_mode or "auto",
    }


def _build_chat_metadata(p: dict, answer_mode: str | None = None, response_time_ms: int | None = None) -> dict:
    metadata = {
        "question_intent": p["question_intent"],
        "question_intent_label": p["question_intent_label"],
        "search_mode": p["search_mode"],
        "best_score": p["best_score"],
        "web_search_used": p["allow_web_search"],
        "source_count": len(p["sources"]),
        "resource_link_count": len(p["resource_links"]),
        "resource_image_count": len(p["resource_images"]),
        "response_mode": p["response_mode"],
        # هویتِ پرسنده — برای نمایش در پنلِ سوالاتِ ادمین.
        "user_id": p.get("user_id", "anonymous"),
        "customer_id": p.get("customer_id"),
        "customer_name": p.get("customer_name", ""),
        "customer_email": p.get("customer_email", ""),
    }
    if answer_mode:
        metadata["answer_mode"] = answer_mode
    if response_time_ms is not None:
        metadata["response_time_ms"] = response_time_ms
    _stage_timings = p.get("stage_timings_ms")
    if _stage_timings:
        metadata["stage_timings_ms"] = _stage_timings
        # مجموع کل = پیش‌پردازش (بازیابی) + کالِ پاسخِ مدل.
        if response_time_ms is not None:
            metadata["total_time_ms"] = int(
                _stage_timings.get("pipeline_total", 0) + response_time_ms
            )
    return metadata


@router.post("/chat", tags=["Chat"], summary="Send message and get AI response")
@limiter.limit("20/minute")
def chat(body: ChatRequest, request: Request):
    p = _build_chat_pipeline(body, client_ip=(request.client.host if request.client else ""))

    chat_requests_total.inc()
    chat_requests_by_intent.labels(intent=p["question_intent"]).inc()

    _t0 = _time.monotonic()
    try:
        answer = ask_expert_assistant(
            message=body.message,
            context=p["context"],
            history=p["history"],
            domain=p["detected_domain"],
            allow_web_search=p["allow_web_search"],
            customer_context=p["customer_context"],
            use_live_web=p.get("use_live_web", False),
        )
        answer_mode = "ai"
    except Exception as e:
        import traceback

        traceback.print_exc()
        logger.warning("AI answer failed, using local answer: %s %s", type(e).__name__, e)
        answer = build_local_answer(body.message, p["related_docs"])
        answer_mode = "local"

    # لینک رسمی ASTM را قطعی الحاق کن (به مدل تکیه نکن — گاهی نادیده می‌گیرد).
    answer = f"{answer}{astm_link_tail(body.message, answer)}"

    _response_time_ms = int((_time.monotonic() - _t0) * 1000)
    ai_response_duration.observe(_response_time_ms / 1000)

    question_id = save_expert_question(
        question=body.message,
        answer=answer,
        sources=p["sources"],
        detected_domain=p["detected_domain"],
        response_time_ms=_response_time_ms,
        metadata=_build_chat_metadata(p, answer_mode, _response_time_ms),
    )

    memory_id = None
    if body.user_id and body.user_id != "anonymous":
        memory_id = save_user_memory(
            user_id=body.user_id,
            question=body.message,
            answer=answer,
            detected_domain=p["detected_domain"],
            memory_type="chat",
            metadata={
                "question_id": question_id,
                "sources": p["sources"],
                "resource_links": p["resource_links"],
                "resource_images": p["resource_images"],
                **_build_chat_metadata(p, answer_mode, _response_time_ms),
            },
        )

    return {
        "question_id": question_id,
        "memory_id": memory_id,
        "detected_domain": p["detected_domain"],
        "answer": answer,
        "sources": p["sources"],
        "resource_links": p["resource_links"] if p["allow_company_reference"] else [],
        "resource_images": p["resource_images"] if p["allow_company_reference"] else [],
        "search_mode": p["search_mode"],
        "web_search_used": p["allow_web_search"],
        "question_intent": p["question_intent"],
        "question_intent_label": p["question_intent_label"],
        "best_score": p["best_score"],
        "source_count": len(p["sources"]),
        "response_mode": p["response_mode"],
        "answer_mode": answer_mode,
        "stage_timings_ms": p["stage_timings_ms"],
    }


@router.post("/chat/stream", tags=["Chat"], summary="Streaming chat (SSE)")
@limiter.limit("20/minute")
def chat_stream(body: ChatRequest, request: Request):
    """همان pipeline چت اما با پاسخ streaming (SSE)."""
    p = _build_chat_pipeline(body, client_ip=(request.client.host if request.client else ""))
    detected_domain = p["detected_domain"]
    allow_company_reference = p["allow_company_reference"]
    is_transform_followup = p["is_transform_followup"]
    search_mode = p["search_mode"]
    resource_links = p["resource_links"]
    resource_images = p["resource_images"]
    allow_web_search = p["allow_web_search"]
    context = p["context"]
    history = p["history"]
    sources = p["sources"]
    question_intent = p["question_intent"]
    question_intent_label = p["question_intent_label"]
    _cust_ctx_stream = p["customer_context"]

    # ── Cache check: only for anonymous users with no history/context ──────────
    _use_cache = (
        not body.history
        and not body.context
        and not body.customer_id
        and not is_transform_followup
    )
    if _use_cache:
        _cached = _response_cache.get(body.message, detected_domain)
        if _cached:
            cache_hits.inc()
        else:
            cache_misses.inc()
        if _cached:
            def _cached_generator():
                yield f"data: {_json_local.dumps(_cached['meta'], ensure_ascii=False)}\n\n"
                text = _cached["answer"]
                chunk_size = 80
                for i in range(0, len(text), chunk_size):
                    chunk = text[i:i+chunk_size]
                    yield f"data: {_json_local.dumps({'type': 'chunk', 'text': chunk}, ensure_ascii=False)}\n\n"
                done = {"type": "done", "question_id": _cached.get("question_id"), "memory_id": None, "from_cache": True}
                yield f"data: {_json_local.dumps(done, ensure_ascii=False)}\n\n"
            return StreamingResponse(
                _cached_generator(),
                media_type="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )

    def event_generator():
        meta = {
            "type": "meta",
            "detected_domain": detected_domain,
            "sources": sources,
            "resource_links": resource_links if allow_company_reference else [],
            "resource_images": resource_images if allow_company_reference else [],
            "search_mode": search_mode,
            "web_search_used": allow_web_search,
            "question_intent": question_intent,
            "question_intent_label": question_intent_label,
            "best_score": p["best_score"],
            "source_count": len(sources),
            "stage_timings_ms": p["stage_timings_ms"],
        }
        yield f"data: {_json_local.dumps(meta, ensure_ascii=False)}\n\n"

        full_answer = ""
        _stream_t0 = _time.monotonic()
        answer_mode = "ai"
        try:
            for chunk in ask_expert_assistant_stream(
                message=body.message,
                context=context,
                history=history,
                domain=detected_domain,
                allow_web_search=allow_web_search,
                customer_context=_cust_ctx_stream,
                use_live_web=p.get("use_live_web", False),
            ):
                full_answer += chunk
                payload = {"type": "chunk", "text": chunk}
                yield f"data: {_json_local.dumps(payload, ensure_ascii=False)}\n\n"
        except Exception as exc:
            answer_mode = "error"
            _exc_str = str(exc).lower()
            if "nameresolution" in _exc_str or "getaddrinfo" in _exc_str or "name or service not known" in _exc_str:
                _err_msg = "⚠️ خطای اتصال: سرور نمی‌تواند به OpenAI متصل شود (مشکل DNS). لطفاً VPN یا پروکسی را فعال کنید و دوباره امتحان کنید."
            elif "remotedisconnected" in _exc_str or "connection aborted" in _exc_str or "connectionreset" in _exc_str:
                _err_msg = "⚠️ خطای شبکه: اتصال به OpenAI قطع شد. ممکن است IP سرور توسط OpenAI مسدود باشد. لطفاً VPN یا پروکسی را فعال کنید."
            elif "timeout" in _exc_str:
                _err_msg = "⚠️ خطای timeout: پاسخ از OpenAI خیلی دیر رسید. لطفاً دوباره امتحان کنید."
            elif "401" in _exc_str or "authentication" in _exc_str or "invalid api key" in _exc_str:
                _err_msg = "⚠️ خطای احراز هویت: کلید API معتبر نیست. لطفاً OPENAI_API_KEY را در فایل .env بررسی کنید."
            elif "429" in _exc_str or "rate limit" in _exc_str:
                _err_msg = "⚠️ محدودیت درخواست: تعداد درخواست‌ها از حد مجاز بیشتر شده. لطفاً چند دقیقه صبر کنید."
            elif "insufficient_quota" in _exc_str or "quota" in _exc_str:
                _err_msg = "⚠️ اعتبار API تمام شده. لطفاً حساب OpenAI را شارژ کنید."
            else:
                _err_msg = "⚠️ خطای غیرمنتظره در دریافت پاسخ. لطفاً دوباره امتحان کنید."
            err = {"type": "error", "message": _err_msg}
            yield f"data: {_json_local.dumps(err, ensure_ascii=False)}\n\n"
            full_answer = _err_msg

        # لینک رسمی ASTM را قطعی به انتها الحاق کن و به‌صورت یک chunk نهایی بفرست
        # (فقط اگر کاربر لینک/منبع خواسته و مدل خودش نداده باشد). مدل گاهی این لینک
        # را نمی‌دهد؛ URL قطعی است پس به مدل تکیه نمی‌کنیم.
        if answer_mode != "error":
            _astm_tail = astm_link_tail(body.message, full_answer)
            if _astm_tail:
                full_answer += _astm_tail
                yield f"data: {_json_local.dumps({'type': 'chunk', 'text': _astm_tail}, ensure_ascii=False)}\n\n"

        question_id = None
        try:
            question_id = save_expert_question(
                question=body.message,
                answer=full_answer,
                sources=sources,
                detected_domain=detected_domain,
                response_time_ms=int((_time.monotonic() - _stream_t0) * 1000),
                metadata=_build_chat_metadata(
                    p,
                    answer_mode=answer_mode,
                    response_time_ms=int((_time.monotonic() - _stream_t0) * 1000),
                ),
            )
            memory_id = None
            if body.user_id and body.user_id != "anonymous":
                memory_id = save_user_memory(
                    user_id=body.user_id,
                    question=body.message,
                    answer=full_answer,
                    detected_domain=detected_domain,
                    memory_type="chat",
                    metadata={
                        "question_id": question_id,
                        "sources": sources,
                        **_build_chat_metadata(
                            p,
                            answer_mode=answer_mode,
                            response_time_ms=int((_time.monotonic() - _stream_t0) * 1000),
                        ),
                    },
                )
            done = {"type": "done", "question_id": question_id, "memory_id": memory_id}
        except Exception:
            done = {"type": "done", "question_id": None, "memory_id": None}

        if _use_cache and full_answer and "خطا" not in full_answer:
            _response_cache.set(body.message, detected_domain, {
                "meta": meta,
                "answer": full_answer,
                "question_id": question_id,
            })

        yield f"data: {_json_local.dumps(done, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/chat/suggest-questions")
def suggest_questions(body: SuggestQuestionsRequest):
    """سه سوال پیشنهادی مرتبط بر اساس سوال و پاسخ قبلی."""
    prompt = f"""بر اساس سوال و پاسخ زیر، دقیقاً ۳ سوال کوتاه و مرتبط فنی/تخصصی در حوزه آزمایشگاه، صنعت نفت، پتروشیمی، کاتالیست یا تجهیزات پیشنهاد بده.

سوال کاربر: {body.question}

پاسخ آرتین (خلاصه): {body.answer[:500]}

خروجی فقط یک JSON آرایه با ۳ رشته باشد، بدون توضیح اضافه:
["سوال اول؟", "سوال دوم؟", "سوال سوم؟"]
"""
    try:
        import re as _re
        import json as _j
        raw = ask_expert_assistant(
            message=prompt,
            context="",
            history=[],
            domain=body.domain,
            allow_web_search=False,
        )
        match = _re.search(r'\[.*?\]', raw, _re.DOTALL)
        if match:
            questions = _j.loads(match.group())
            return {"questions": questions[:3]}
        return {"questions": []}
    except Exception:
        return {"questions": []}
