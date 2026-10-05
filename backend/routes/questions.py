import logging
import threading
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import Response

from schemas.models import QuestionReviewRequest, FeedbackRequest, GuestIdentityRequest
from utils.deps import require_admin, limiter

from db_service import (
    get_recent_questions,
    get_question_stats,
    get_question_analytics,
    get_question_by_id,
    update_question_review,
    get_all_questions,
    get_questions_for_export,
    attach_guest_identity,
    save_question_feedback,
    get_feedback_stats,
    log_knowledge_action,
)
from knowledge_service import add_text_to_knowledge_base

logger = logging.getLogger("artin_scheduler")

router = APIRouter()


def save_question_review(question_id: int, request: QuestionReviewRequest):
    updated = update_question_review(
        question_id=question_id,
        expert_status=request.expert_status,
        expert_note=request.expert_note,
        reviewed_answer=request.reviewed_answer,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="سوال موردنظر پیدا نشد.")
    return {
        "success": True,
        "question_id": question_id,
        "expert_status": request.expert_status,
    }


@router.put("/questions/{question_id}/review")
def review_question_put(question_id: int, request: QuestionReviewRequest, _=Depends(require_admin)):
    return save_question_review(question_id, request)


@router.patch("/questions/{question_id}/review")
def review_question_patch(question_id: int, request: QuestionReviewRequest, _=Depends(require_admin)):
    return save_question_review(question_id, request)


@router.post("/questions/attach-identity", tags=["Chat"], summary="Name a guest's earlier questions")
@limiter.limit("6/minute")
def attach_identity(request: Request, body: GuestIdentityRequest):
    """وقتی بازدیدکننده نام و شماره‌اش را می‌دهد، سوال‌های قبلی‌اش را به نامش ثبت می‌کند.

    Public on purpose: it is called right after the guest fills in the contact
    card, before any account exists. It only writes a name onto rows that carry
    the caller's own anonymous user_id and belong to no customer, so the worst
    a bad actor achieves is mislabelling their own questions.
    """
    updated = attach_guest_identity(
        user_id=body.user_id,
        full_name=body.full_name,
        phone=body.phone,
        email=body.email,
    )
    return {"success": True, "updated": updated}


@router.post("/questions/{question_id}/feedback")
def question_feedback(question_id: int, body: FeedbackRequest):
    """ذخیره امتیاز کاربر (👍👎) برای یک پاسخ آرتین."""
    ok = save_question_feedback(question_id, body.rating, body.comment)
    if not ok:
        raise HTTPException(status_code=404, detail="سوال پیدا نشد یا امتیاز نامعتبر است.")
    return {"success": True, "rating": body.rating}


@router.get("/admin/feedback-stats")
def feedback_stats(_=Depends(require_admin)):
    """آمار کلی امتیازات کاربران برای داشبورد ادمین."""
    return get_feedback_stats()


@router.get("/questions/recent", tags=["Admin"], summary="Recent questions")
def questions_recent(limit: int = 20, _=Depends(require_admin)):
    return {"questions": get_recent_questions(limit=limit)}


@router.get("/questions/stats", tags=["Admin"], summary="Question statistics")
def questions_stats(_=Depends(require_admin)):
    return get_question_stats()


@router.get("/questions/analytics", tags=["Admin"], summary="Question analytics")
def questions_analytics(days: int = 7):
    return get_question_analytics(days=days)


@router.get("/questions/stats-public")
def questions_stats_public():
    """آمار عمومی بدون نیاز به احراز هویت ادمین — برای صفحه Home."""
    stats = get_question_stats()
    feedback = get_feedback_stats()
    return {
        "total_questions": stats.get("total_questions", 0),
        "satisfaction_pct": feedback.get("satisfaction_pct"),
    }


@router.get("/questions")
def questions_all(
    limit: int = 200,
    domain: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    rating: Optional[str] = None,
    _=Depends(require_admin),
):
    return {
        "questions": get_all_questions(
            limit=limit,
            domain=domain,
            date_from=date_from,
            date_to=date_to,
            rating=rating,
        )
    }


@router.get("/questions/{question_id}")
def question_detail(question_id: int, _=Depends(require_admin)):
    question = get_question_by_id(question_id)
    if not question:
        return {"error": "سوال موردنظر پیدا نشد."}
    return question


@router.post("/questions/{question_id}/add-to-knowledge")
def question_add_to_knowledge(question_id: int, _=Depends(require_admin)):
    question = get_question_by_id(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="سوال موردنظر پیدا نشد.")
    if question["expert_status"] != "approved":
        raise HTTPException(
            status_code=422,
            detail="فقط سوالات تاییدشده توسط کارشناس می‌توانند به بانک دانش اضافه شوند.",
        )

    final_answer = question["reviewed_answer"] or question["answer"]

    content = f"""
    پرسش تاییدشده توسط کارشناس آرتین آزما

    حوزه:
    {question["detected_domain"]}

    سوال مشتری:
    {question["question"]}

    پاسخ تاییدشده:
    {final_answer}

    یادداشت داخلی کارشناس:
    {question["expert_note"]}
    """

    result = add_text_to_knowledge_base(
        title=f"FAQ تاییدشده #{question_id} - {question['detected_domain']}",
        content=content,
        category="expert-faq",
        file_name=f"expert_faq_question_{question_id}.txt",
    )
    if result.get("success"):
        log_knowledge_action(
            action="expert_faq_add",
            file_name=result.get("file_name", f"expert_faq_question_{question_id}.txt"),
            title=result.get("title", f"FAQ تاییدشده #{question_id}"),
            category=result.get("category", "expert-faq"),
            detail=(
                f"{result.get('chunks_added', 0)} chunk از پاسخ تاییدشده سوال #{question_id} اضافه شد"
                + (
                    f"؛ {result.get('removed_old_chunks', 0)} chunk قبلی جایگزین شد"
                    if result.get("removed_old_chunks", 0)
                    else ""
                )
            ),
        )
    return result


# سقفِ تعداد سوال در یک PDF، بر پایهٔ سرعتِ اندازه‌گیری‌شدهٔ خودِ سرور: حدود ۱.۲
# ثانیه به‌ازای هر سوال (روی یک لپ‌تاپ ۰.۲ ثانیه است — CPU این VPS برای این کارِ
# تک‌رشته‌ای حدود ۶ برابر کندتر است). مسیر دانلود یک سقف سخت ۱۰۰ ثانیه‌ای دارد،
# پس ۶۰ سوال (~۷۰ ثانیه) بیشترین چیزی است که مطمئن می‌رسد.
PDF_MAX_QUESTIONS = 60

# ساخت PDF کاملاً CPU-محور است و اگر مرورگر دانلود را نیمه‌کاره رها کند، کار روی
# سرور ادامه پیدا می‌کند. بدون این قفل، هر تلاشِ دوبارهٔ کاربر یک کارِ رهاشدهٔ
# دیگر روی قبلی‌ها انباشته می‌کرد و سرور را کندتر و کندتر می‌کرد (میانگین واقعی
# روی پروداکشن: ۴۰۳ ثانیه برای هر درخواست). فقط یک ساختِ هم‌زمان اجازه داریم.
_PDF_BUILD_LOCK = threading.Lock()


def _parse_ids(ids: Optional[str]) -> Optional[list[int]]:
    """رشته «1,2,3» را به لیست شناسه تبدیل می‌کند؛ مقادیر نامعتبر نادیده گرفته می‌شوند."""
    if not ids:
        return None
    parsed = [int(part) for part in ids.split(",") if part.strip().isdigit()]
    return parsed or None


@router.get("/admin/questions/export-csv")
def export_questions_csv(
    limit: int = 5000,
    domain: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    rating: Optional[str] = None,
    status: Optional[str] = None,
    ids: Optional[str] = None,
    _=Depends(require_admin),
):
    """خروجی CSV کامل از سوالات (با فیلتر حوزه/تاریخ/امتیاز/وضعیت یا شناسه‌های انتخابی)."""
    import csv
    import io
    questions = get_questions_for_export(
        limit=limit, domain=domain, date_from=date_from, date_to=date_to,
        rating=rating, status=status, ids=_parse_ids(ids),
    )
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "شناسه", "تاریخ ثبت", "پرسنده", "سوال", "پاسخ", "حوزه", "نوع سوال",
        "وضعیت بررسی", "یادداشت کارشناس", "پاسخ اصلاح‌شده",
        "امتیاز کاربر", "نظر کاربر", "زمان پاسخ (ms)",
    ])
    for q in questions:
        writer.writerow([
            q.get("id", ""),
            q.get("created_at", ""),
            q.get("customer_name", ""),
            q.get("question", ""),
            q.get("answer", ""),
            q.get("detected_domain", ""),
            q.get("question_intent", ""),
            q.get("expert_status", "pending"),
            q.get("expert_note", ""),
            q.get("reviewed_answer", ""),
            q.get("user_rating", ""),
            q.get("user_rating_comment", ""),
            q.get("response_time_ms", ""),
        ])
    csv_bytes = output.getvalue().encode("utf-8-sig")
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=questions.csv"},
    )


@router.get("/admin/questions/export-pdf")
def export_questions_pdf(
    limit: int = 5000,
    domain: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    rating: Optional[str] = None,
    status: Optional[str] = None,
    ids: Optional[str] = None,
    _=Depends(require_admin),
):
    """خروجی PDF گزارشی از سوالات (با فیلتر حوزه/تاریخ/امتیاز/وضعیت یا شناسه‌های انتخابی).

    ساخت PDF فارسی پرهزینه است (هر ~۵۰ سوال حدود ۱۰ ثانیه)، بنابراین حداکثر
    PDF_MAX_QUESTIONS سوالِ اخیر خروجی می‌گیرد؛ برای بازه‌های بزرگ‌تر از فیلترها
    (تاریخ/حوزه) یا خروجی CSV استفاده شود.
    """
    from pdf_export_service import build_questions_pdf

    capped = min(limit, PDF_MAX_QUESTIONS)
    questions = get_questions_for_export(
        limit=capped, domain=domain, date_from=date_from,
        date_to=date_to, rating=rating, status=status, ids=_parse_ids(ids),
    )
    # اگر دقیقاً به سقف خوردیم، احتمالاً سوال‌های قدیمی‌تری هم بوده‌اند؛ در خودِ
    # سند بگو تا خروجیِ ناقص به‌اشتباه «کامل» تلقی نشود.
    note = (
        f"این خروجی به {capped} سوال محدود شده است (سقف هر PDF). برای بقیه،"
        " خروجی را در چند بخش بگیرید یا از خروجی CSV استفاده کنید."
        if len(questions) == capped
        else ""
    )
    if not _PDF_BUILD_LOCK.acquire(timeout=2):
        raise HTTPException(
            status_code=429,
            detail="یک خروجی PDF در حال ساخت است. چند لحظه صبر کنید و دوباره تلاش کنید.",
        )
    try:
        _t0 = time.monotonic()
        pdf_bytes = build_questions_pdf(questions, note=note)
        logger.info(
            "PDF export: %d questions, %d KB, %.1fs",
            len(questions), len(pdf_bytes) // 1024, time.monotonic() - _t0,
        )
    finally:
        _PDF_BUILD_LOCK.release()

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=questions.pdf"},
    )
