import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from schemas.models import QuestionReviewRequest, FeedbackRequest
from utils.deps import require_admin

from db_service import (
    get_recent_questions,
    get_question_stats,
    get_question_analytics,
    get_question_by_id,
    update_question_review,
    get_all_questions,
    get_questions_for_export,
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


@router.get("/admin/questions/export-csv")
def export_questions_csv(_=Depends(require_admin)):
    """خروجی CSV کامل از همه سوالات (متن پاسخ، پرسنده، امتیاز، بازبینی) برای Excel."""
    import csv
    import io
    questions = get_questions_for_export(limit=5000)
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
def export_questions_pdf(limit: int = 5000, _=Depends(require_admin)):
    """خروجی PDF گزارشی از سوالات کاربران (فارسی، راست‌به‌چپ) برای دانلود."""
    from pdf_export_service import build_questions_pdf

    questions = get_questions_for_export(limit=limit)
    pdf_bytes = build_questions_pdf(questions)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=questions.pdf"},
    )
