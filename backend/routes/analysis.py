import os
import logging

from fastapi import APIRouter, Request, UploadFile, File, Form, HTTPException
from typing import Optional

from utils.deps import limiter
from utils.chat_utils import make_safe_filename, _MAX_UPLOAD_BYTES, _ALLOWED_FILE_EXTS, _ALLOWED_IMAGE_EXTS

from ai_service import ask_expert_assistant, analyze_image_with_ai
from ai_service import client as ai_client
from file_analyzer import analyze_excel_or_csv, read_pdf_text

logger = logging.getLogger("artin_scheduler")

router = APIRouter()


@router.post("/analyze-file", tags=["Analysis"], summary="Analyze Excel/CSV/PDF file")
@limiter.limit("10/minute")
def analyze_file(
    request: Request,
    file: UploadFile = File(...),
    test_type: str = Form("general"),
    user_note: str = Form(""),
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

    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, safe_filename)
    file_url = f"/uploads/{safe_filename}"

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

        اگر داده کافی نیست، صریح بگو چه داده‌هایی لازم است.
        """

        ai_answer = ask_expert_assistant(prompt)

        return {
            "file_type": ext,
            "test_type": test_type,
            "test_type_label": selected_test_type,
            "raw_analysis": analysis,
            "file_url": file_url,
            "file_name": safe_filename,
            "ai_analysis": ai_answer,
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
        """

        ai_answer = ask_expert_assistant(prompt)

        return {
            "file_type": ext,
            "test_type": test_type,
            "test_type_label": selected_test_type,
            "extracted_text": text[:2000],
            "file_url": file_url,
            "file_name": safe_filename,
            "ai_analysis": ai_answer,
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

    try:
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)

        file_path = os.path.join(upload_dir, safe_filename)
        file_url = f"/uploads/{safe_filename}"
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

        ai_answer = analyze_image_with_ai(file_path, user_note=combined_note)

        return {
            "file_type": ext,
            "file_name": safe_filename,
            "file_url": file_url,
            "image_type": image_type,
            "image_type_label": selected_image_type,
            "ai_analysis": ai_answer,
        }

    except Exception as e:
        return {"error": f"خطا در تحلیل تصویر: {str(e)}"}
