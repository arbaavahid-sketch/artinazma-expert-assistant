import os
import time
import uuid
import logging
from typing import Optional

from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException

from utils.deps import limiter
from utils.chat_utils import make_safe_filename, _MAX_UPLOAD_BYTES, _ALLOWED_FILE_EXTS, _ALLOWED_IMAGE_EXTS

from ai_service import ask_expert_assistant, analyze_image_with_ai
from ai_service import client as ai_client
from file_analyzer import analyze_excel_or_csv, read_pdf_text
from local_search_service import local_search_knowledge_base
from knowledge_service import search_knowledge_base
from db_service import save_expert_question, save_user_memory

logger = logging.getLogger("artin_scheduler")

router = APIRouter()


def _unique_upload_name(safe_filename: str) -> str:
    """Prefix with a short unique token so two customers uploading the same
    filename don't overwrite each other (these files are now referenced from
    the saved question, so they must persist distinctly)."""
    return f"{int(time.time())}_{uuid.uuid4().hex[:6]}_{safe_filename}"


def _resolve_user_id(user_id: str, customer_id: Optional[int]) -> str:
    """Mirror the /chat rule so analyses link to the same customer identity."""
    if customer_id and (not user_id or user_id == "anonymous"):
        return f"customer_{customer_id}"
    return user_id or "anonymous"


def _persist_analysis(
    *, question: str, answer: str, domain: str, user_id: str,
    response_time_ms: int, metadata: dict,
) -> Optional[int]:
    """Save an analysis interaction so it shows up in the admin questions panel
    (and, for logged-in customers, in their history) exactly like a chat."""
    # هویتِ پرسنده برای پنلِ ادمین (همان الگوی /chat).
    metadata.setdefault("user_id", user_id)
    if metadata.get("customer_id"):
        try:
            from db_service import get_customer_by_id
            _cust = get_customer_by_id(metadata["customer_id"])
            if _cust:
                metadata.setdefault("customer_name", _cust.get("full_name") or "")
                metadata.setdefault("customer_email", _cust.get("email") or "")
        except Exception as exc:
            logger.warning("customer lookup for analysis metadata failed: %s", exc)
    question_id = None
    try:
        question_id = save_expert_question(
            question=question,
            answer=answer,
            sources=[],
            detected_domain=domain,
            response_time_ms=response_time_ms,
            metadata=metadata,
        )
    except Exception as exc:
        logger.warning("persist analysis (question) failed: %s", exc)
    try:
        if user_id and user_id != "anonymous":
            save_user_memory(
                user_id=user_id,
                question=question,
                answer=answer,
                detected_domain=domain,
                memory_type="analysis",
                metadata={"question_id": question_id, **metadata},
            )
    except Exception as exc:
        logger.warning("persist analysis (memory) failed: %s", exc)
    return question_id


def _analysis_kb_context(query: str, top_k: int = 4) -> str:
    """
    زمینه‌ی مرتبط از بانک دانش (استانداردها، روش‌ها، کاتالوگ محصولات) را برای
    تحلیل فایل/تصویر برمی‌گرداند تا تفسیر «مستند» شود و بتواند استاندارد و
    محصولِ واقعیِ آرتین آزما را پیشنهاد دهد (به‌جای ساختن). هر خطا → رشته‌ی خالی
    (تحلیل هرگز به‌خاطر بازیابی متوقف نشود).
    """
    query = (query or "").strip()
    if not query:
        return ""
    docs: list = []
    try:
        docs = search_knowledge_base(query, top_k=top_k) or []
    except Exception as e:  # noqa: BLE001
        logger.info("analysis KB semantic search failed: %s", e)
    if not docs:
        try:
            docs = (local_search_knowledge_base(query, top_k=top_k) or [])[:top_k]
        except Exception as e:  # noqa: BLE001
            logger.info("analysis KB local search failed: %s", e)
    if not docs:
        return ""
    parts = []
    for d in docs:
        parts.append(
            f"منبع داخلی:\nعنوان: {d.get('title', '')}\n"
            f"فایل: {d.get('file_name', '')}\n"
            f"متن:\n{(d.get('content', '') or '')[:800]}"
        )
    return "\n\n".join(parts)


# دستورِ خروجیِ مشترک برای گراند‌کردن تحلیل روی بانک دانش (استاندارد + محصول واقعی).
_ANALYSIS_GROUNDING = (
    "پس از بخش‌های تحلیل، این دو بخش را هم اضافه کن:\n"
    "- «استاندارد/روش مرجع مرتبط»: اگر آزمون یا داده به استاندارد مشخصی (ASTM/ISO/…) "
    "مربوط است، آن را نام ببر و کوتاه توضیح بده.\n"
    "- «تجهیز یا خدمت پیشنهادی آرتین آزما»: فقط اگر در «منابع داخلی» محصول/دستگاه مرتبطی "
    "آمده، همان مدلِ واقعی را پیشنهاد بده؛ اگر نبود، مدل نساز و فقط نوعِ دستگاه/خدمت مناسب "
    "را بگو و کاربر را برای مدل دقیق به ثبت استعلام دعوت کن."
)


@router.post("/analyze-file", tags=["Analysis"], summary="Analyze Excel/CSV/PDF file")
@limiter.limit("10/minute")
def analyze_file(
    request: Request,
    file: UploadFile = File(...),
    test_type: str = Form("general"),
    user_note: str = Form(""),
    user_id: str = Form("anonymous"),
    customer_id: Optional[int] = Form(None),
):
    safe_filename = make_safe_filename(file.filename or "upload")
    ext = safe_filename.lower().rsplit(".", 1)[-1]
    if ext not in _ALLOWED_FILE_EXTS:
        raise HTTPException(
            status_code=415,
            detail=f"فرمت .{ext} پشتیبانی نمی‌شود. فرمت‌های مجاز: {', '.join(sorted(_ALLOWED_FILE_EXTS))}",
        )

    content = file.file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="حجم فایل بیش از ۲۰ مگابایت است.")

    _t0 = time.monotonic()
    resolved_user_id = _resolve_user_id(user_id, customer_id)

    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    stored_name = _unique_upload_name(safe_filename)
    file_path = os.path.join(upload_dir, stored_name)
    file_url = f"/uploads/{stored_name}"

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    test_type_labels = {
        "general": "گزارش عمومی آزمایشگاهی",
        "catalyst": "تست کاتالیست",
        "chromatography": "کروماتوگرافی GC/HPLC",
        "mercury": "آنالیز جیوه",
        "sulfur": "آنالیز سولفور",
        "metals": "آنالیز عنصری / فلزات",
    }

    selected_test_type = test_type_labels.get(test_type, "گزارش عمومی آزمایشگاهی")

    analysis_guides = {
        "general": """
        تحلیل را به شکل عمومی آزمایشگاهی انجام بده:
        - خلاصه گزارش
        - نتایج مهم
        - شاخص‌های غیرعادی
        - تفسیر فنی
        - پیشنهاد اقدام بعدی
        - سوالات تکمیلی از مشتری
        """,
        "catalyst": """
        تحلیل را مخصوص تست کاتالیست انجام بده:
        - Conversion
        - Selectivity
        - Yield
        - روند افت فعالیت یا Deactivation
        - پایداری عملکرد
        - اثر دما، فشار، زمان و خوراک
        - علت‌های احتمالی افت عملکرد
        - تست‌های تکمیلی پیشنهادی مثل BET, XRD, TPR, TPD, SEM, ICP
        """,
        "chromatography": """
        تحلیل را مخصوص GC/HPLC انجام بده:
        - رفتار پیک‌ها
        - Retention Time
        - Baseline
        - Resolution
        - Peak Area
        - احتمال co-elution
        - وضعیت کالیبراسیون
        - مشکلات احتمالی ستون، دتکتور، تزریق یا گاز حامل
        - چک‌لیست عیب‌یابی
        """,
        "mercury": """
        تحلیل را مخصوص آنالیز جیوه انجام بده:
        - نوع نمونه و ماتریس احتمالی
        - سطح جیوه و معنی فنی آن
        - احتمال آلودگی، memory effect یا خطای آماده‌سازی
        - نیاز به blank, duplicate, spike recovery
        - پیشنهاد روش یا دستگاه مناسب
        """,
        "sulfur": """
        تحلیل را مخصوص آنالیز سولفور انجام بده:
        - نوع ترکیبات گوگردی احتمالی
        - Total Sulfur / H2S / Mercaptan / COS / CS2 در صورت وجود
        - بررسی دقت و محدوده اندازه‌گیری
        - تفسیر برای LPG, گاز طبیعی، سوخت یا نمونه صنعتی
        - پیشنهاد روش و دتکتور مناسب
        """,
        "metals": """
        تحلیل را مخصوص آنالیز عنصری و فلزات انجام بده:
        - عناصر مهم
        - غلظت‌های غیرعادی
        - اثر ماتریس نمونه
        - نیاز به digestion یا آماده‌سازی بهتر
        - کنترل کیفیت شامل blank, standard, CRM, spike
        - پیشنهاد روش‌های AAS, ICP, XRF یا روش مناسب دیگر
        """,
    }

    guide = analysis_guides.get(test_type, analysis_guides["general"])

    if ext in ["xlsx", "xls", "csv"]:
        analysis = analyze_excel_or_csv(file_path)

        prompt = f"""
        این فایل تست برای شرکت آرتین آزما تحلیل شود.

        نوع تست انتخاب‌شده:
        {selected_test_type}

        توضیح کاربر:
        {user_note if user_note else "توضیحی ارائه نشده است."}

        اطلاعات استخراج‌شده از فایل:
        {analysis}

        راهنمای تحلیل تخصصی:
        {guide}

        خروجی را فارسی، تخصصی و کاربردی بده و دقیقاً با این ساختار بنویس:
        1. خلاصه مدیریتی
        2. نوع داده و برداشت اولیه
        3. شاخص‌های مهم
        4. روندها و نقاط غیرعادی
        5. تفسیر تخصصی بر اساس نوع تست
        6. علت‌های احتمالی
        7. پیشنهاد اقدام بعدی
        8. سوالات تکمیلی که باید از مشتری پرسیده شود

        {_ANALYSIS_GROUNDING}

        اگر داده کافی نیست، صریح بگو چه داده‌هایی لازم است.
        """

        _kb = _analysis_kb_context(f"{selected_test_type} {user_note} {str(analysis)[:400]}")
        ai_answer = ask_expert_assistant(prompt, context=_kb, allow_web_search=False)

        question_id = _persist_analysis(
            question=f"[تحلیل فایل · {selected_test_type}]"
            + (f" — {user_note.strip()}" if user_note.strip() else f" — {safe_filename}"),
            answer=ai_answer, domain="file-analysis", user_id=resolved_user_id,
            response_time_ms=int((time.monotonic() - _t0) * 1000),
            metadata={
                "analysis_type": "file", "file_url": file_url, "file_name": safe_filename,
                "test_type": test_type, "test_type_label": selected_test_type,
                "user_note": user_note, "customer_id": customer_id,
            },
        )
        return {
            "file_type": ext,
            "test_type": test_type,
            "test_type_label": selected_test_type,
            "raw_analysis": analysis,
            "file_url": file_url,
            "file_name": safe_filename,
            "ai_analysis": ai_answer,
            "question_id": question_id,
        }

    if ext == "pdf":
        text = read_pdf_text(file_path)

        prompt = f"""
        این PDF تست یا گزارش آزمایشگاهی برای شرکت آرتین آزما تحلیل شود.

        نوع تست انتخاب‌شده:
        {selected_test_type}

        توضیح کاربر:
        {user_note if user_note else "توضیحی ارائه نشده است."}

        متن استخراج‌شده از PDF:
        {text}

        راهنمای تحلیل تخصصی:
        {guide}

        خروجی را فارسی، تخصصی و کاربردی بده و دقیقاً با این ساختار بنویس:
        1. خلاصه مدیریتی
        2. موضوع گزارش
        3. نتایج مهم
        4. ابهام‌ها یا داده‌های ناقص
        5. تفسیر تخصصی بر اساس نوع تست
        6. علت‌های احتمالی
        7. پیشنهاد اقدام بعدی
        8. سوالات تکمیلی از مشتری

        {_ANALYSIS_GROUNDING}
        """

        _kb = _analysis_kb_context(f"{selected_test_type} {user_note} {text[:400]}")
        ai_answer = ask_expert_assistant(prompt, context=_kb, allow_web_search=False)

        question_id = _persist_analysis(
            question=f"[تحلیل فایل · {selected_test_type}]"
            + (f" — {user_note.strip()}" if user_note.strip() else f" — {safe_filename}"),
            answer=ai_answer, domain="file-analysis", user_id=resolved_user_id,
            response_time_ms=int((time.monotonic() - _t0) * 1000),
            metadata={
                "analysis_type": "file", "file_url": file_url, "file_name": safe_filename,
                "test_type": test_type, "test_type_label": selected_test_type,
                "user_note": user_note, "customer_id": customer_id,
            },
        )
        return {
            "file_type": ext,
            "test_type": test_type,
            "test_type_label": selected_test_type,
            "extracted_text": text[:2000],
            "file_url": file_url,
            "file_name": safe_filename,
            "ai_analysis": ai_answer,
            "question_id": question_id,
        }

    return {"error": "فعلاً فقط فایل‌های Excel, CSV و PDF پشتیبانی می‌شوند."}


@router.post("/transcribe", tags=["Analysis"], summary="Transcribe audio to text")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe audio using OpenAI Whisper - works in Iran unlike Web Speech API."""
    try:
        audio_bytes = await file.read()
        filename = file.filename or "audio.webm"
        import io as _io
        audio_file = _io.BytesIO(audio_bytes)
        audio_file.name = filename
        transcript = ai_client.audio.transcriptions.create(
            model="whisper-1",
            file=(filename, audio_bytes, file.content_type or "audio/webm"),
            language="fa",
        )
        return {"transcript": transcript.text}
    except Exception as e:
        logger.error("Transcription error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze-image", tags=["Analysis"], summary="Analyze image with AI")
@limiter.limit("10/minute")
def analyze_image(
    request: Request,
    file: UploadFile = File(...),
    image_type: str = Form("general"),
    user_note: str = Form(""),
    user_id: str = Form("anonymous"),
    customer_id: Optional[int] = Form(None),
):
    safe_filename = make_safe_filename(file.filename or "upload")
    ext = safe_filename.lower().rsplit(".", 1)[-1]
    if ext not in _ALLOWED_IMAGE_EXTS:
        raise HTTPException(
            status_code=415,
            detail=f"فرمت .{ext} پشتیبانی نمی‌شود. فرمت‌های مجاز: JPG، PNG، WEBP",
        )

    content = file.file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="حجم فایل بیش از ۲۰ مگابایت است.")

    _t0 = time.monotonic()
    resolved_user_id = _resolve_user_id(user_id, customer_id)

    try:
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)

        stored_name = _unique_upload_name(safe_filename)
        file_path = os.path.join(upload_dir, stored_name)
        file_url = f"/uploads/{stored_name}"
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        image_type_labels = {
            "general": "تصویر عمومی",
            "device-error": "خطای دستگاه",
            "chromatogram": "کروماتوگرام",
            "chart": "نمودار تست",
            "software-screen": "صفحه نرم‌افزار دستگاه",
            "lab-report": "گزارش تصویری آزمایشگاهی",
        }

        selected_image_type = image_type_labels.get(image_type, "تصویر عمومی")

        combined_note = f"""
        نوع تصویر انتخاب‌شده:
        {selected_image_type}

        توضیح کاربر:
        {user_note if user_note else "توضیحی ارائه نشده است."}

        بر اساس نوع تصویر، تحلیل را دقیق‌تر انجام بده.
        اگر تصویر خطای دستگاه است، علت‌های احتمالی و چک‌لیست عیب‌یابی بده.
        اگر کروماتوگرام است، پیک‌ها، baseline، retention time و مشکلات احتمالی را بررسی کن.
        اگر نمودار تست است، روند، نقاط غیرعادی و تفسیر فنی بده.
        اگر صفحه نرم‌افزار است، پیام‌ها، وضعیت دستگاه و اقدام بعدی را توضیح بده.
        """

        _kb = _analysis_kb_context(f"{selected_image_type} {user_note}")
        if _kb:
            combined_note += (
                "\n\nمنابع داخلی مرتبط (برای مستندسازی تفسیر و پیشنهاد محصول واقعی):\n"
                f"{_kb}\n"
            )
        combined_note += "\n\n" + _ANALYSIS_GROUNDING

        ai_answer = analyze_image_with_ai(file_path, user_note=combined_note)

        _elapsed_ms = int((time.monotonic() - _t0) * 1000)
        _question_text = (
            f"[تحلیل تصویر · {selected_image_type}]"
            + (f" — {user_note.strip()}" if user_note.strip() else "")
        )
        question_id = _persist_analysis(
            question=_question_text,
            answer=ai_answer,
            domain="image-analysis",
            user_id=resolved_user_id,
            response_time_ms=_elapsed_ms,
            metadata={
                "analysis_type": "image",
                "image_url": file_url,
                "image_type": image_type,
                "image_type_label": selected_image_type,
                "file_name": safe_filename,
                "user_note": user_note,
                "customer_id": customer_id,
            },
        )

        return {
            "file_type": ext,
            "file_name": safe_filename,
            "file_url": file_url,
            "image_type": image_type,
            "image_type_label": selected_image_type,
            "ai_analysis": ai_answer,
            "question_id": question_id,
        }

    except Exception as e:
        return {"error": f"خطا در تحلیل تصویر: {str(e)}"}
