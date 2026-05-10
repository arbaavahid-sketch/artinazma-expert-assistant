import os
import re
from fastapi.staticfiles import StaticFiles
import shutil
from comparison_table_service import ensure_comparison_table
from standard_service import get_context_for_app
from answer_formatter_service import format_answer_for_ui
from answer_quality_service import build_answer_quality_context
from intent_service import detect_question_intent
from artinazma_index_service import rebuild_artinazma_index, load_index
from site_resource_service import find_artinazma_resources
from local_search_service import local_search_knowledge_base, build_local_answer
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from pydantic import BaseModel
from google_drive_service import sync_google_drive_folder
from knowledge_service import (
    add_file_to_knowledge_base,
    search_knowledge_base,
    get_knowledge_stats,
    delete_knowledge_file,
    knowledge_file_exists,
    add_text_to_knowledge_base
)
from ai_service import ask_expert_assistant, analyze_image_with_ai
from file_analyzer import analyze_excel_or_csv, read_pdf_text
from db_service import (
    init_db,
    detect_domain,
    save_expert_question,
    get_recent_questions,
    get_question_stats,
    get_question_by_id,
    update_question_review,
    save_user_memory,
    search_user_memories,
    get_user_memory_stats,
    save_customer_request,
    delete_all_customer_chat_sessions,
    get_customer_requests,
    update_customer_request_status,
    get_customer_request_stats,
    create_customer,
    authenticate_customer,
    get_customer_by_id,
    update_customer_profile,
    create_chat_session,
    save_chat_message,
    get_customer_chat_sessions,
    get_chat_messages,
    update_chat_session_title,
    delete_chat_session,
    get_all_questions
)
app = FastAPI(title="ArtinAzma Expert Assistant API")
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
init_db()
frontend_origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000"
)

allowed_origins = [
    origin.strip()
    for origin in frontend_origins.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
def make_safe_filename(filename: str) -> str:
    base_name = os.path.basename(filename or "uploaded_file")
    safe_name = base_name.replace(" ", "_")
    safe_name = re.sub(r"[^A-Za-z0-9_\-.\u0600-\u06FF]", "_", safe_name)

    if not safe_name or safe_name in [".", ".."]:
        safe_name = "uploaded_file"

    return safe_name
def is_specific_product_or_model_question(message: str) -> bool:
    text = (message or "").lower()

    latin_tokens = re.findall(
        r"\b[A-Za-z][A-Za-z0-9\-]{1,}\b",
        message or ""
    )

    if not latin_tokens:
        return False

    # این‌ها تکنیک، روش، استاندارد یا اصطلاح عمومی هستند؛ مدل محصول حساب نشوند
    known_technical_terms = {
        "xrf", "edxrf", "wdxrf", "xrd",
        "icp", "icp-oes", "icp-ms", "aas",
        "gc", "gc-ms", "gcms", "hplc", "lc",
        "ftir", "uv", "uv-vis", "uvvis",
        "nmr", "ms", "fid", "tcd", "ecd", "fpd", "scd",
        "bet", "tpr", "tpd", "sem", "tem",
        "astm", "iso", "epa", "en", "api", "nace",
        "btex", "voc", "h2s", "cos", "cs2",
        "lod", "loq", "rsd", "qc", "crm",
        "tan", "tbn", "cfpp",
    }

    normalized_tokens = {
        token.strip().lower()
        for token in latin_tokens
        if token.strip()
    }

    # اگر همه کلمات لاتین از جنس تکنیک/استاندارد/پارامتر هستند، مدل دستگاه نیست
    if normalized_tokens and all(token in known_technical_terms for token in normalized_tokens):
        return False

    model_keywords = [
        "مدل",
        "دستگاه",
        "آنالایزر",
        "مشخصات",
        "دیتاشیت",
        "کاتالوگ",
        "manual",
        "datasheet",
        "catalog",
        "model",
        "device",
        "instrument",
        "analyzer",
        "part number",
        "serial",
    ]

    # کلمه «چیست» را از این لیست حذف کردیم، چون سوال‌های عمومی مثل XRF چیست را خراب می‌کرد.
    if not any(keyword in text for keyword in model_keywords):
        return False

    # اگر حداقل یک token لاتین شبیه مدل واقعی باشد
    # مثال: SpectroScan SE، GC-5000، DMA-4500، M4000
    has_model_like_token = any(
        (
            re.search(r"\d", token) or
            "-" in token or
            len(token) >= 6
        )
        and token.lower() not in known_technical_terms
        for token in normalized_tokens
    )

    return has_model_like_token
def context_has_exact_model_match(message: str, docs: list) -> bool:
    
    model_tokens = re.findall(
        r"[A-Za-z][A-Za-z0-9\-]{2,}(?:\s+[A-Za-z0-9\-]{2,})?",
        message or ""
    )

    if not model_tokens:
        return False

    searchable_context = " ".join(
        f"{doc.get('title', '')} {doc.get('file_name', '')} {doc.get('content', '')}"
        for doc in docs
    ).lower()

    for token in model_tokens:
        clean_token = token.strip().lower()

        if clean_token and clean_token in searchable_context:
            return True

    return False
def is_artinazma_related_question(message: str) -> bool:
    text = (message or "").lower()

    keywords = [
        "آرتین آزما",
        "ارتین ازما",
        "آرتین‌آزما",
        "artinazma",
        "artin azma",
        "سایت شما",
        "سایتتون",
        "وبسایت شما",
        "شرکت شما",
        "نمایندگی شما",
        "محصولات شما",
        "تو سایت شما",
        "در سایت شما",
        "آیا شما",
        "شما دارید",
        "شما تامین",
        "از شما بخرم",
        "خرید از شما",
        "استعلام قیمت",
        "قیمت",
        "موجودی",
        "پیش فاکتور",
        "پیش‌فاکتور",
        "سفارش",
        "تماس",
        "شماره تماس",
        "ایمیل",
        "واتساپ",
        "آدرس",
        "دفتر تهران",
        "دفتر بوشهر",
    ]

    return any(keyword in text for keyword in keywords)


def remove_company_mentions_if_not_allowed(answer: str) -> str:
    if not answer:
        return ""

    blocked_patterns = [
        r".*آرتین آزما مهر.*\n?",
        r".*آرتین آزما.*\n?",
        r".*ارتین ازما.*\n?",
        r".*artinazma\.net.*\n?",
        r".*info@artinazma\.net.*\n?",
        r".*09906060910.*\n?",
        r".*02191008898.*\n?",
        r".*صفحه مرتبط در سایت.*\n?",
        r".*سایت رسمی.*\n?",
        r".*برای اطلاعات بیشتر.*کارشناسان.*\n?",
        r".*برای راهنمایی بیشتر.*ایمیل.*\n?",
        r".*برای دریافت پیش.?فاکتور.*\n?",
    ]

    cleaned = answer

    for pattern in blocked_patterns:
        cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)

    return cleaned.strip()

class ChatHistoryMessage(BaseModel):
    role: str
    content: str

class GoogleDriveSyncRequest(BaseModel):
    root_folder_id: str = ""
    max_files: int = 200
    force_resync: bool = False
class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatHistoryMessage]] = None
    domain: Optional[str] = "auto"
    response_mode: Optional[str] = "auto"
    user_id: Optional[str] = "anonymous"
class MemorySearchRequest(BaseModel):
    user_id: str
    query: str = ""
    limit: int = 50
class QuestionReviewRequest(BaseModel):
    expert_status: str
    expert_note: str = ""
    reviewed_answer: str = ""
class CustomerRequestCreate(BaseModel):
    full_name: str
    company: str = ""
    phone: str
    email: str = ""
    request_type: str = "consultation"
    subject: str = ""
    message: str
class CustomerRequestStatusUpdate(BaseModel):
    status: str
class CustomerRegisterRequest(BaseModel):
    full_name: str
    email: str
    password: str
    company: str = ""
    phone: str = ""


class CustomerLoginRequest(BaseModel):
    email: str
    password: str
class CustomerProfileUpdateRequest(BaseModel):
    full_name: str
    company: str = ""
    phone: str = ""

class CustomerSessionCreateRequest(BaseModel):
    customer_id: int
    title: str = "گفتگوی جدید"
class CustomerSessionUpdateRequest(BaseModel):
    customer_id: int
    title: str

class CustomerChatMessageCreateRequest(BaseModel):
    customer_id: int
    session_id: int
    role: str
    content: str
    metadata: dict = {}
@app.get("/")
def home():
    return {
        "message": "ArtinAzma Expert Assistant API is running"
    }

def save_question_review(question_id: int, request: QuestionReviewRequest):
    updated = update_question_review(
        question_id=question_id,
        expert_status=request.expert_status,
        expert_note=request.expert_note,
        reviewed_answer=request.reviewed_answer,
    )

    if not updated:
        return {
            "success": False,
            "message": "Question not found",
        }

    return {
        "success": True,
        "question_id": question_id,
        "expert_status": request.expert_status,
    }


@app.put("/questions/{question_id}/review")
def review_question_put(question_id: int, request: QuestionReviewRequest):
    return save_question_review(question_id, request)


@app.patch("/questions/{question_id}/review")
def review_question_patch(question_id: int, request: QuestionReviewRequest):
    return save_question_review(question_id, request)
@app.post("/chat")
def chat(request: ChatRequest):
    has_astm_code = bool(
        re.search(r"\bD\s*\d{3,5}\b", request.message, flags=re.IGNORECASE)
    )

    specific_model_question = is_specific_product_or_model_question(request.message)
    allow_company_reference = is_artinazma_related_question(request.message)
    intent_data = detect_question_intent(
    message=request.message,
    domain=request.domain or "auto"
    )

    question_intent = intent_data["intent"]
    question_intent_label = intent_data["label"]
    intent_instruction = intent_data["instruction"]
    local_docs = local_search_knowledge_base(request.message, top_k=12)

    best_score = 0.0
    related_docs = []
    search_mode = "unknown"

    if has_astm_code and local_docs:
        related_docs = local_docs[:8]
        search_mode = "local_astm"

    elif specific_model_question:
        exact_local_match = context_has_exact_model_match(request.message, local_docs)

        if exact_local_match and local_docs and float(local_docs[0].get("score", 0) or 0) >= 8:
            related_docs = local_docs[:8]
            search_mode = "local_exact_model"
        else:
            related_docs = []
            search_mode = "no_exact_model_context"

    else:
        if local_docs and float(local_docs[0].get("score", 0) or 0) >= 10:
            related_docs = local_docs[:8]
            search_mode = "local_fast"
        else:
            try:
                related_docs = search_knowledge_base(request.message, top_k=5)
                search_mode = "ai_vector"
            except Exception as e:
                print("AI vector search failed, using local search:", e)
                related_docs = local_docs[:8]
                search_mode = "local_fallback"

    if related_docs:
        try:
            best_score = float(related_docs[0].get("score", 0) or 0)
        except Exception:
            best_score = 0.0

    # برای سوالات عمومی فنی، مقایسه‌ای، انتخاب روش یا عیب‌یابی،
    # اگر منبع داخلی خیلی مطمئن نیست، اجازه نده منبع نامرتبط جواب را خراب کند.
    if question_intent in [
        "technical_general",
        "equipment_recommendation",
        "troubleshooting",
        "lab_analysis",
    ]:
        if best_score < 14:
            related_docs = []
            best_score = 0.0
            search_mode = f"{search_mode}+ignored_weak_internal_context"
    
    resource_links = []
    resource_images = []
    artinazma_context = ""

    if allow_company_reference:
        try:
            artinazma_resources = find_artinazma_resources(
                message=request.message,
                max_results=2,
            )

            resource_links = artinazma_resources.get("links", [])
            resource_images = artinazma_resources.get("images", [])

            if resource_links:
                artinazma_context = """
نتیجه جست‌وجوی سایت رسمی آرتین آزما:
این مورد در سایت رسمی آرتین آزما پیدا شده است.
هنگام پاسخ، کامل و فنی توضیح بده.
در متن پاسخ، لینک خام ننویس؛ لینک جداگانه توسط سیستم نمایش داده می‌شود.
اگر مشخصات دقیق محصول در متن منابع داخلی نیست، با دانش فنی معتبر تکمیل کن، اما ادعای ساختگی نکن.
"""

                for link in resource_links:
                    artinazma_context += f"\nعنوان صفحه: {link.get('title', '')}"
                    artinazma_context += f"\nلینک صفحه: {link.get('url', '')}\n"

                search_mode = f"{search_mode}+artinazma_site"

        except Exception as e:
            print("ArtinAzma resource search failed:", e)
            resource_links = []
            resource_images = []
            artinazma_context = ""
    else:
        resource_links = []
        resource_images = []
        artinazma_context = ""

    allow_web_search = False

    if specific_model_question:
        allow_web_search = True
    elif has_astm_code:
        allow_web_search = True
    elif not related_docs:
        allow_web_search = True
    elif search_mode in ["ai_vector", "local_fallback"] and best_score < 0.35:
        allow_web_search = True

    if allow_web_search:
        search_mode = f"{search_mode}+openai_web"

    context = ""

    if related_docs:
        context_parts = []

        for doc in related_docs:
            context_parts.append(
                f"""
                منبع داخلی:
                عنوان: {doc.get('title', '')}
                فایل: {doc.get('file_name', '')}
                دسته‌بندی: {doc.get('category', '')}
                امتیاز ارتباط: {doc.get('score', '')}
                متن:
                {doc.get('content', '')}
                """
            )

        context = "\n\n".join(context_parts)

    if artinazma_context:
        context = f"{context}\n\n{artinazma_context}".strip()
    
    auto_domain = detect_domain(request.message)
    selected_domain = request.domain or "auto"
    detected_domain = auto_domain if selected_domain == "auto" else selected_domain

    history = [
        {
            "role": item.role,
            "content": item.content
        }
        for item in (request.history or [])
    ]
    intent_context = f"""
    تشخیص نوع درخواست کاربر:
    {question_intent_label}

    دستور اختصاصی برای نوع این درخواست:
    {intent_instruction}
    """

    context = f"{context}\n\n{intent_context}".strip()

    quality_context = ""

    try:
        quality_context = build_answer_quality_context(
            message=request.message,
            intent=question_intent,
            intent_label=question_intent_label,
            domain=detected_domain,
        )
    except Exception as e:
        print("Answer quality context failed:", e)
        quality_context = ""

    if quality_context:
        context = f"{context}\n\n{quality_context}".strip()

    standard_context = ""

    try:
        standard_context = get_context_for_app(request.message)
    except Exception as e:
        print("Standard engine failed:", e)
        standard_context = ""

    if standard_context:
        context = f"{context}\n\n{standard_context}".strip()

    
    if allow_company_reference:
        company_visibility_context = """
    قانون نمایش اطلاعات شرکت:
    کاربر در این پیام درباره آرتین آزما، سایت، تماس، خرید، استعلام، نمایندگی یا محصولات شرکت پرسیده است.
    در صورت نیاز، اشاره به اطلاعات شرکت، لینک سایت یا مسیر تماس مجاز است.
    """
    else:
        company_visibility_context = """
    قانون نمایش اطلاعات شرکت:
    کاربر در این پیام درباره آرتین آزما، سایت، تماس، خرید، استعلام، نمایندگی یا محصولات شرکت نپرسیده است.

    بنابراین در پاسخ نهایی:
    - نام آرتین آزما مهر را نیاور.
    - لینک سایت نده.
    - ایمیل، شماره تماس، واتساپ یا آدرس نده.
    - پیشنهاد تماس با شرکت نده.
    - عبارت‌هایی مثل «کارشناسان ما»، «شرکت ما»، «سایت رسمی ما» ننویس.
    - پاسخ فقط فنی، تخصصی، بی‌طرف و کاربردی باشد.
    """

    response_mode = request.response_mode or "auto"

    response_mode_instructions = {
        "auto": """
    نوع پاسخ انتخابی کاربر: هوشمند.
    بر اساس نوع سؤال، بهترین ساختار پاسخ را انتخاب کن.
    """,
        "brief": """
    نوع پاسخ انتخابی کاربر: خلاصه و کاربردی.
    پاسخ باید کوتاه، مستقیم و تصمیم‌ساز باشد.
    از توضیح طولانی، مقدمه‌چینی و بخش‌بندی زیاد خودداری کن.
    حداکثر ۳ بخش اصلی بنویس.
    """,
        "technical": """
    نوع پاسخ انتخابی کاربر: فنی کامل.
    پاسخ باید تخصصی‌تر، دقیق‌تر و کامل‌تر باشد.
    نکات فنی، محدودیت‌ها، خطاهای رایج، آماده‌سازی نمونه، QC و معیار انتخاب را در صورت ارتباط توضیح بده.
    عدد، استاندارد یا مشخصه فنی نساز مگر داده قطعی وجود داشته باشد.
    """,
        "checklist": """
    نوع پاسخ انتخابی کاربر: چک‌لیست عملیاتی.
    پاسخ را به صورت مرحله‌ای و قابل اجرا بنویس.
    از بولت و شماره‌گذاری استفاده کن.
    تمرکز روی اقدامات عملی، بررسی‌ها، اطلاعات لازم و خطاهای قابل کنترل باشد.
    """,
    }

    context = f"{context}\n\n{response_mode_instructions.get(response_mode, response_mode_instructions['auto'])}".strip()
    context = f"{context}\n\n{company_visibility_context}".strip()
    try:
        answer = ask_expert_assistant(
            message=request.message,
            context=context,
            history=history,
            domain=detected_domain,
            allow_web_search=allow_web_search
        )

        answer = format_answer_for_ui(answer)

        answer_mode = "ai"

    except Exception as e:
        print("AI answer failed, using local answer:", e)

        answer = build_local_answer(request.message, related_docs)
        answer = format_answer_for_ui(answer)

        answer_mode = "local"
    if not allow_company_reference:
       answer = remove_company_mentions_if_not_allowed(answer)
    sources = [
        {
            "title": doc.get("title", ""),
            "file_name": doc.get("file_name", ""),
            "category": doc.get("category", ""),
            "score": float(doc.get("score", 0) or 0)
        }
        for doc in related_docs
    ]

    question_id = save_expert_question(
        question=request.message,
        answer=answer,
        sources=sources,
        detected_domain=detected_domain
    )

    memory_id = None

    if request.user_id and request.user_id != "anonymous":
        memory_id = save_user_memory(
            user_id=request.user_id,
            question=request.message,
            answer=answer,
            detected_domain=detected_domain,
            memory_type="chat",
            metadata={
                "question_id": question_id,
                "sources": sources,
                "search_mode": search_mode,
                "web_search_used": allow_web_search,
                "answer_mode": answer_mode,
                "resource_links": resource_links,
                "resource_images": resource_images,
                "question_intent": question_intent,
                "question_intent_label": question_intent_label,
                
            }
        )

    return {
        "question_id": question_id,
        "memory_id": memory_id,
        "detected_domain": detected_domain,
        "answer": answer,
        "sources": sources,
        "resource_links": resource_links if allow_company_reference else [],
        "resource_images": resource_images if allow_company_reference else [],
        "search_mode": search_mode,
        "web_search_used": allow_web_search,
        "question_intent": question_intent,
        "question_intent_label": question_intent_label,
        "response_mode": response_mode,
        "answer_mode": answer_mode
    }
@app.post("/analyze-file")
async def analyze_file(
    file: UploadFile = File(...),
    test_type: str = Form("general"),
    user_note: str = Form("")
):
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = make_safe_filename(file.filename)
    file_path = os.path.join(upload_dir, safe_filename)
    file_url = f"/uploads/{safe_filename}"
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    ext = safe_filename.lower().split(".")[-1]

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
            "ai_analysis": ai_answer
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
            "ai_analysis": ai_answer
        }

    return {
        "error": "فعلاً فقط فایل‌های Excel, CSV و PDF پشتیبانی می‌شوند."
    }
@app.post("/knowledge/upload")
async def upload_knowledge_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form("general"),
    replace_existing: bool = Form(False)
):
    upload_dir = "knowledge_files"
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = make_safe_filename(file.filename)
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = add_file_to_knowledge_base(
        file_path=file_path,
        title=title or safe_filename,
        category=category or "general",
        replace_existing=replace_existing
    )

    return result


@app.post("/knowledge/sync-google-drive")
def knowledge_sync_google_drive(request: GoogleDriveSyncRequest):
    folder_id = request.root_folder_id.strip() or os.getenv(
        "GOOGLE_DRIVE_ROOT_FOLDER_ID",
        ""
    ).strip()

    if not folder_id:
        return {
            "success": False,
            "message": "GOOGLE_DRIVE_ROOT_FOLDER_ID تنظیم نشده است."
        }

    try:
        return sync_google_drive_folder(
            root_folder_id=folder_id,
            max_files=request.max_files,
            force_resync=request.force_resync
        )
    except Exception as e:
        return {
            "success": False,
            "message": f"خطا در همگام‌سازی Google Drive: {str(e)}"
        }


@app.get("/knowledge/stats")
def knowledge_stats():
    return get_knowledge_stats()
@app.delete("/knowledge/files/{file_name}")
def knowledge_file_delete(file_name: str):
    return delete_knowledge_file(file_name)
@app.delete("/customers/{customer_id}/chat-sessions")
def customer_chat_sessions_delete_all(customer_id: int):
    customer = get_customer_by_id(customer_id)

    if not customer:
        return {
            "success": False,
            "message": "مشتری پیدا نشد.",
            "deleted_sessions": 0
        }

    deleted_sessions = delete_all_customer_chat_sessions(customer_id)

    return {
        "success": True,
        "message": "همه گفتگوهای مشتری حذف شدند.",
        "deleted_sessions": deleted_sessions
    }
@app.post("/knowledge/search")
def knowledge_search(request: ChatRequest):
    query = request.message

    has_astm_code = bool(
        re.search(r"\bD\s*\d{3,5}\b", query, flags=re.IGNORECASE)
    )

    if has_astm_code:
        local_results = local_search_knowledge_base(query, top_k=10)

        if local_results:
            results = local_results
        else:
            results = search_knowledge_base(query, top_k=10)
    else:
        try:
            results = search_knowledge_base(query, top_k=10)
        except Exception:
            results = local_search_knowledge_base(query, top_k=10)

    return {
        "query": query,
        "results": [
            {
                "title": item["title"],
                "file_name": item["file_name"],
                "category": item["category"],
                "score": float(item.get("score", 0)),
                "content": item["content"][:900]
            }
            for item in results
        ]
    }
@app.get("/questions/recent")
def questions_recent(limit: int = 20):
    return {
        "questions": get_recent_questions(limit=limit)
    }


@app.get("/questions/stats")
def questions_stats():
    return get_question_stats()
@app.get("/questions")
def questions_all(limit: int = 100):
    return {
        "questions": get_all_questions(limit=limit)
    }


@app.get("/questions/{question_id}")
def question_detail(question_id: int):
    question = get_question_by_id(question_id)

    if not question:
        return {
            "error": "سوال موردنظر پیدا نشد."
        }

    return question


@app.patch("/questions/{question_id}/review")
def question_review(question_id: int, request: QuestionReviewRequest):
    updated = update_question_review(
        question_id=question_id,
        expert_status=request.expert_status,
        expert_note=request.expert_note,
        reviewed_answer=request.reviewed_answer
    )

    if not updated:
        return {
            "success": False,
            "message": "سوال موردنظر پیدا نشد."
        }

    return {
        "success": True,
        "message": "بررسی کارشناس با موفقیت ذخیره شد."
    }
@app.post("/questions/{question_id}/add-to-knowledge")
def question_add_to_knowledge(question_id: int):
    question = get_question_by_id(question_id)

    if not question:
        return {
            "success": False,
            "message": "سوال موردنظر پیدا نشد."
        }

    if question["expert_status"] != "approved":
        return {
            "success": False,
            "message": "فقط سوالات تاییدشده توسط کارشناس می‌توانند به بانک دانش اضافه شوند."
        }

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
        file_name=f"expert_faq_question_{question_id}.txt"
    )

    return result
@app.post("/analyze-image")
async def analyze_image(
    file: UploadFile = File(...),
    image_type: str = Form("general"),
    user_note: str = Form("")
):
    try:
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)

        safe_filename = make_safe_filename(file.filename)
        file_path = os.path.join(upload_dir, safe_filename)
        file_url = f"/uploads/{safe_filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        ext = safe_filename.lower().split(".")[-1]

        if ext not in ["jpg", "jpeg", "png", "webp"]:
            return {
                "error": f"فرمت تصویر .{ext} فعلاً پشتیبانی نمی‌شود. لطفاً تصویر را به JPG، PNG یا WEBP تبدیل کنید."
            }

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
    "ai_analysis": ai_answer
}

    except Exception as e:
        return {
            "error": f"خطا در تحلیل تصویر: {str(e)}"
        }


@app.post("/memory/search")
def memory_search(request: MemorySearchRequest):
    return {
        "memories": search_user_memories(
            user_id=request.user_id,
            query=request.query,
            limit=request.limit
        )
    }


@app.get("/memory/stats/{user_id}")
def memory_stats(user_id: str):
    return get_user_memory_stats(user_id)
@app.post("/customer-requests")
def create_customer_request(request: CustomerRequestCreate):
    request_id = save_customer_request(
        full_name=request.full_name,
        company=request.company,
        phone=request.phone,
        email=request.email,
        request_type=request.request_type,
        subject=request.subject,
        message=request.message
    )

    return {
        "success": True,
        "request_id": request_id,
        "message": "درخواست شما با موفقیت ثبت شد. کارشناسان آرتین آزما با شما تماس خواهند گرفت."
    }


@app.get("/customer-requests")
def customer_requests(limit: int = 100):
    return {
        "requests": get_customer_requests(limit=limit)
    }


@app.patch("/customer-requests/{request_id}/status")
def customer_request_status(request_id: int, request: CustomerRequestStatusUpdate):
    updated = update_customer_request_status(
        request_id=request_id,
        status=request.status
    )

    if not updated:
        return {
            "success": False,
            "message": "درخواست موردنظر پیدا نشد."
        }

    return {
        "success": True,
        "message": "وضعیت درخواست بروزرسانی شد."
    }


@app.get("/customer-requests/stats")
def customer_requests_stats():
    return get_customer_request_stats()
@app.get("/system/status")
def system_status(check_ai: bool = False):
    openai_key = os.getenv("OPENAI_API_KEY", "").strip()

    knowledge_stats_data = get_knowledge_stats()

    openai_configured = bool(
        openai_key
        and openai_key != "test_offline_mode"
        and not openai_key.startswith("x-")
    )

    ai_status = "not_checked"
    ai_error = ""

    if check_ai:
        if not openai_configured:
            ai_status = "not_configured"
            ai_error = "OPENAI_API_KEY تنظیم نشده یا عمداً برای حالت آفلاین غیرفعال شده است."
        else:
            try:
                test_answer = ask_expert_assistant(
                    message="فقط کلمه OK را برگردان.",
                    context="",
                    history=[],
                    domain="health-check"
                )

                if test_answer:
                    ai_status = "connected"
                else:
                    ai_status = "unknown"
                    ai_error = "پاسخ خالی از سرویس AI دریافت شد."

            except Exception as e:
                ai_status = "failed"
                ai_error = str(e)

    return {
        "backend_status": "running",
        "openai_configured": openai_configured,
        "openai_status": ai_status,
        "openai_error": ai_error,
        "local_fallback_enabled": True,
        "knowledge_stats": knowledge_stats_data,
        }
@app.post("/customers/register")
def customer_register(request: CustomerRegisterRequest):
    if not request.full_name.strip():
        return {
            "success": False,
            "message": "نام و نام خانوادگی الزامی است."
        }

    if not request.email.strip():
        return {
            "success": False,
            "message": "ایمیل الزامی است."
        }

    if len(request.password) < 6:
        return {
            "success": False,
            "message": "رمز عبور باید حداقل ۶ کاراکتر باشد."
        }

    result = create_customer(
        full_name=request.full_name,
        email=request.email,
        password=request.password,
        company=request.company,
        phone=request.phone
    )

    if not result.get("success"):
        return result

    customer = get_customer_by_id(result["customer_id"])

    return {
        "success": True,
        "message": "ثبت‌نام با موفقیت انجام شد.",
        "customer": customer
    }


@app.post("/customers/login")
def customer_login(request: CustomerLoginRequest):
    customer = authenticate_customer(
        email=request.email,
        password=request.password
    )

    if not customer:
        return {
            "success": False,
            "message": "ایمیل یا رمز عبور اشتباه است."
        }

    return {
        "success": True,
        "message": "ورود با موفقیت انجام شد.",
        "customer": customer
    }


@app.get("/customers/{customer_id}")
def customer_profile(customer_id: int):
    customer = get_customer_by_id(customer_id)

    if not customer:
        return {
            "success": False,
            "message": "مشتری پیدا نشد."
        }

    return {
        "success": True,
        "customer": customer
    }

@app.patch("/customers/{customer_id}")
def customer_profile_update(customer_id: int, request: CustomerProfileUpdateRequest):
    updated_customer = update_customer_profile(
        customer_id=customer_id,
        full_name=request.full_name,
        company=request.company,
        phone=request.phone
    )

    if not updated_customer:
        return {
            "success": False,
            "message": "مشتری پیدا نشد یا نام وارد نشده است."
        }

    return {
        "success": True,
        "message": "اطلاعات حساب با موفقیت بروزرسانی شد.",
        "customer": updated_customer
    }
@app.get("/customers/{customer_id}/chat-sessions")
def customer_chat_sessions(customer_id: int):
    customer = get_customer_by_id(customer_id)

    if not customer:
        return {
            "success": False,
            "message": "مشتری پیدا نشد.",
            "sessions": []
        }

    return {
        "success": True,
        "sessions": get_customer_chat_sessions(customer_id)
    }


@app.post("/customers/chat-sessions")
def customer_chat_session_create(request: CustomerSessionCreateRequest):
    customer = get_customer_by_id(request.customer_id)

    if not customer:
        return {
            "success": False,
            "message": "مشتری پیدا نشد."
        }

    session_id = create_chat_session(
        customer_id=request.customer_id,
        title=request.title.strip() or "گفتگوی جدید"
    )

    return {
        "success": True,
        "session_id": session_id
    }


@app.get("/customers/{customer_id}/chat-sessions/{session_id}/messages")
def customer_chat_session_messages(customer_id: int, session_id: int):
    customer = get_customer_by_id(customer_id)

    if not customer:
        return {
            "success": False,
            "message": "مشتری پیدا نشد.",
            "messages": []
        }

    return {
        "success": True,
        "messages": get_chat_messages(
            session_id=session_id,
            customer_id=customer_id
        )
    }


@app.post("/customers/chat-messages")
def customer_chat_message_create(request: CustomerChatMessageCreateRequest):
    customer = get_customer_by_id(request.customer_id)

    if not customer:
        return {
            "success": False,
            "message": "مشتری پیدا نشد."
        }

    message_id = save_chat_message(
        session_id=request.session_id,
        role=request.role,
        content=request.content,
        metadata=request.metadata
    )

    return {
        "success": True,
        "message_id": message_id
    }
@app.patch("/customers/chat-sessions/{session_id}")
def customer_chat_session_update(
    session_id: int,
    request: CustomerSessionUpdateRequest
):
    customer = get_customer_by_id(request.customer_id)

    if not customer:
        return {
            "success": False,
            "message": "مشتری پیدا نشد."
        }

    updated = update_chat_session_title(
        session_id=session_id,
        customer_id=request.customer_id,
        title=request.title
    )

    if not updated:
        return {
            "success": False,
            "message": "گفتگوی موردنظر پیدا نشد."
        }

    return {
        "success": True,
        "message": "نام گفتگو تغییر کرد."
    }


@app.delete("/customers/{customer_id}/chat-sessions/{session_id}")
def customer_chat_session_delete(customer_id: int, session_id: int):
    customer = get_customer_by_id(customer_id)

    if not customer:
        return {
            "success": False,
            "message": "مشتری پیدا نشد."
        }

    deleted = delete_chat_session(
        session_id=session_id,
        customer_id=customer_id
    )

    if not deleted:
        return {
            "success": False,
            "message": "گفتگوی موردنظر پیدا نشد."
        }

    return {
        "success": True,
        "message": "گفتگو حذف شد."
    }
@app.post("/knowledge/index-artinazma-site")
def index_artinazma_site(force: bool = False):
    return rebuild_artinazma_index(force=force)


@app.get("/knowledge/artinazma-site-index")
def artinazma_site_index_status():
    index_data = load_index()

    return {
        "count": len(index_data.get("items", [])),
        "created_at": index_data.get("created_at", 0),
        "base_url": index_data.get("base_url", ""),
    }