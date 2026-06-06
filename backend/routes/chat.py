import re
import json as _json_local
import logging
import time as _time

from fastapi import APIRouter, Request, Depends
from fastapi.responses import StreamingResponse

from schemas.models import ChatRequest, SuggestQuestionsRequest
from utils.deps import limiter, require_admin
from utils.chat_utils import (
    make_response_cache,
    _ASTM_KNOWN_STANDARDS,
    _LOCAL_SCORE_THRESHOLD,
    _MODEL_LOCAL_SCORE_THRESHOLD,
    _WEAK_CONTEXT_THRESHOLD,
    _TECHNICAL_INTENTS,
    is_specific_product_or_model_question,
    context_has_exact_model_match,
    is_artinazma_related_question,
    is_followup_transform_request,
)

from intent_service import detect_question_intent
from local_search_service import local_search_knowledge_base, build_local_answer
from knowledge_service import search_knowledge_base
from site_resource_service import find_artinazma_resources
from ai_service import ask_expert_assistant, ask_expert_assistant_stream
from db_service import (
    save_expert_question,
    save_user_memory,
    detect_domain,
    get_customer_cross_session_context,
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


def _build_chat_pipeline(body: ChatRequest) -> dict:
    """
    Shared pre-processing pipeline for /chat and /chat/stream.
    Returns a dict with all computed fields needed by both endpoints.
    """
    has_astm_code = bool(
        re.search(r"\bD\s*\d{3,5}\b", body.message, flags=re.IGNORECASE)
    )
    specific_model_question = is_specific_product_or_model_question(body.message)
    allow_company_reference = is_artinazma_related_question(body.message)
    is_transform_followup = is_followup_transform_request(body.message)
    intent_data = detect_question_intent(message=body.message, domain=body.domain or "auto")

    question_intent: str = intent_data["intent"]
    question_intent_label: str = intent_data["label"]
    local_docs = local_search_knowledge_base(body.message, top_k=12)

    best_score = 0.0
    related_docs: list = []
    search_mode = "unknown"

    # ── استخراج عنوان استاندارد ASTM از دیکشنری داخلی ──
    _astm_inject: str = ""
    if has_astm_code:
        _astm_matches = re.findall(r"\bD\s*(\d{3,5})\b", body.message, flags=re.IGNORECASE)
        _injected_titles = [
            _ASTM_KNOWN_STANDARDS[f"D{n}"]
            for n in _astm_matches
            if f"D{n}" in _ASTM_KNOWN_STANDARDS
        ]
        if _injected_titles:
            _astm_inject = (
                "اطلاعات دقیق استاندارد (از پایگاه دانش داخلی):\n"
                + "\n".join(f"• {t}" for t in _injected_titles)
                + "\n⚠️ قانون مطلق: دقیقاً همین استاندارد(ها) را توضیح بده. هرگز کد را با کد دیگری جایگزین نکن."
            )

    if has_astm_code:
        related_docs = []
        search_mode = "gpt_astm_direct"
    elif specific_model_question:
        exact_local_match = context_has_exact_model_match(body.message, local_docs)
        if (
            exact_local_match
            and local_docs
            and float(local_docs[0].get("score", 0) or 0) >= _MODEL_LOCAL_SCORE_THRESHOLD
        ):
            related_docs = local_docs[:8]
            search_mode = "local_exact_model"
        else:
            related_docs = []
            search_mode = "no_exact_model_context"
    else:
        if local_docs and float(local_docs[0].get("score", 0) or 0) >= _LOCAL_SCORE_THRESHOLD:
            related_docs = local_docs[:8]
            search_mode = "local_fast"
        else:
            try:
                related_docs = search_knowledge_base(body.message, top_k=5)
                search_mode = "ai_vector"
            except Exception as e:
                logger.warning("AI vector search failed, using local: %s", e)
                related_docs = local_docs[:8]
                search_mode = "local_fallback"

    if related_docs:
        try:
            best_score = float(related_docs[0].get("score", 0) or 0)
        except Exception:
            best_score = 0.0

    if question_intent in _TECHNICAL_INTENTS and best_score < _WEAK_CONTEXT_THRESHOLD:
        related_docs = []
        best_score = 0.0
        search_mode = f"{search_mode}+ignored_weak_internal_context"

    # ── Site resource lookup ──
    resource_links: list = []
    resource_images: list = []
    artinazma_context = _astm_inject

    if allow_company_reference:
        try:
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

    # ── Web search flag ──
    allow_web_search = True
    if body.response_mode == "brief":
        allow_web_search = False
    if question_intent in _TECHNICAL_INTENTS:
        allow_web_search = True
    if specific_model_question or has_astm_code or not related_docs:
        allow_web_search = True
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
        "پاسخ باید شبیه ChatGPT Plus باشد: کامل، دقیق، آموزشی، تیتردار، مرتب، با جدول، مثال و جمع‌بندی.\n"
        "قانون پاسخ تأییدشده: برای سؤال‌های تخصصی و فنی، از منبع معتبر استفاده کن.\n"
        "پاسخ فارسی باشد."
    )
    if is_transform_followup:
        style_instructions = (
            "قانون بسیار مهم برای درخواست‌های بازنویسی:\n"
            "پیام فعلی کاربر یک درخواست بازنویسی است. از history استفاده کن.\n"
            "web search انجام نده. اطلاعات جدید اضافه نکن.\n"
            "اگر کاربر خواست «تبدیل به جدول»: فقط Markdown table معتبر تولید کن.\n"
            "از tab یا <br> داخل جدول استفاده نکن. هر ردیف تعداد ستون برابر داشته باشد."
        )

    context = f"{context}\n\n---\n\n{style_instructions}".strip() if context else style_instructions

    # ── Sources list ──
    sources = [
        {
            "title": doc.get("title", ""),
            "file_name": doc.get("file_name", ""),
            "category": doc.get("category", ""),
            "score": float(doc.get("score", 0) or 0),
        }
        for doc in related_docs
    ]

    # ── Customer cross-session context ──
    customer_context = ""
    if body.customer_id:
        try:
            customer_context = get_customer_cross_session_context(body.customer_id)
            if not body.user_id or body.user_id == "anonymous":
                body.user_id = f"customer_{body.customer_id}"
        except Exception as _e:
            logger.warning("customer_context load failed: %s", _e)

    return {
        "has_astm_code": has_astm_code,
        "specific_model_question": specific_model_question,
        "allow_company_reference": allow_company_reference,
        "is_transform_followup": is_transform_followup,
        "question_intent": question_intent,
        "question_intent_label": question_intent_label,
        "related_docs": related_docs,
        "best_score": best_score,
        "search_mode": search_mode,
        "allow_web_search": allow_web_search,
        "context": context,
        "detected_domain": detected_domain,
        "history": history,
        "sources": sources,
        "resource_links": resource_links,
        "resource_images": resource_images,
        "customer_context": customer_context,
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
    }
    if answer_mode:
        metadata["answer_mode"] = answer_mode
    if response_time_ms is not None:
        metadata["response_time_ms"] = response_time_ms
    return metadata


@router.post("/chat", tags=["Chat"], summary="Send message and get AI response")
@limiter.limit("20/minute")
def chat(body: ChatRequest, request: Request):
    p = _build_chat_pipeline(body)

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
        )
        answer_mode = "ai"
    except Exception as e:
        import traceback; traceback.print_exc()
        logger.warning("AI answer failed, using local answer: %s %s", type(e).__name__, e)
        answer = build_local_answer(body.message, p["related_docs"])
        answer_mode = "local"
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
    }


@router.post("/chat/stream", tags=["Chat"], summary="Streaming chat (SSE)")
@limiter.limit("20/minute")
def chat_stream(body: ChatRequest, request: Request):
    """همان pipeline چت اما با پاسخ streaming (SSE)."""
    p = _build_chat_pipeline(body)
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
