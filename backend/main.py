import os
import shutil
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from knowledge_service import (
    add_file_to_knowledge_base,
    search_knowledge_base,
    get_knowledge_stats,
    add_text_to_knowledge_base
)
from ai_service import ask_expert_assistant
from file_analyzer import analyze_excel_or_csv, read_pdf_text
from db_service import (
    init_db,
    detect_domain,
    save_expert_question,
    get_recent_questions,
    get_question_stats,
    get_question_by_id,
    update_question_review,
    get_all_questions
)
app = FastAPI(title="ArtinAzma Expert Assistant API")
init_db()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
class QuestionReviewRequest(BaseModel):
    expert_status: str
    expert_note: str = ""
    reviewed_answer: str = ""

@app.get("/")
def home():
    return {
        "message": "ArtinAzma Expert Assistant API is running"
    }


@app.post("/chat")
def chat(request: ChatRequest):
    related_docs = search_knowledge_base(request.message, top_k=5)

    context = ""

    if related_docs:
        context_parts = []

        for doc in related_docs:
            context_parts.append(
                f"""
                منبع: {doc['title']}
                فایل: {doc['file_name']}
                دسته‌بندی: {doc['category']}
                امتیاز ارتباط: {doc['score']}
                متن:
                {doc['content']}
                """
            )

        context = "\n\n".join(context_parts)

    answer = ask_expert_assistant(request.message, context=context)

    sources = [
        {
            "title": doc["title"],
            "file_name": doc["file_name"],
            "category": doc["category"],
            "score": doc["score"]
        }
        for doc in related_docs
    ]

    detected_domain = detect_domain(request.message)

    question_id = save_expert_question(
        question=request.message,
        answer=answer,
        sources=sources,
        detected_domain=detected_domain
    )

    return {
        "question_id": question_id,
        "detected_domain": detected_domain,
        "answer": answer,
        "sources": sources
    }


@app.post("/analyze-file")
async def analyze_file(file: UploadFile = File(...)):
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    ext = file.filename.lower().split(".")[-1]

    if ext in ["xlsx", "xls", "csv"]:
        analysis = analyze_excel_or_csv(file_path)

        prompt = f"""
        این داده تست آزمایشگاهی یا صنعتی را برای شرکت آرتین آزما تحلیل کن.

        اطلاعات استخراج‌شده از فایل:
        {analysis}

        خروجی را به این شکل بده:
        1. خلاصه کلی
        2. شاخص‌های مهم
        3. روندها و نقاط غیرعادی
        4. تفسیر تخصصی احتمالی
        5. پیشنهاد تست‌های تکمیلی
        6. سوالاتی که باید از مشتری پرسیده شود
        """

        ai_answer = ask_expert_assistant(prompt)

        return {
            "file_type": ext,
            "raw_analysis": analysis,
            "ai_analysis": ai_answer
        }

    if ext == "pdf":
        text = read_pdf_text(file_path)

        prompt = f"""
        این گزارش PDF را برای شرکت آرتین آزما تحلیل کن.

        متن استخراج‌شده:
        {text}

        خروجی را به این شکل بده:
        1. موضوع گزارش
        2. نتایج مهم
        3. مشکلات یا ابهام‌ها
        4. تفسیر تخصصی
        5. پیشنهاد اقدام بعدی
        """

        ai_answer = ask_expert_assistant(prompt)

        return {
            "file_type": ext,
            "extracted_text": text[:2000],
            "ai_analysis": ai_answer
        }

    return {
        "error": "فعلاً فقط فایل‌های Excel, CSV و PDF پشتیبانی می‌شوند."
    }
@app.post("/knowledge/upload")
async def upload_knowledge_file(
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form("general")
):
    upload_dir = "knowledge_files"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = add_file_to_knowledge_base(
        file_path=file_path,
        title=title or file.filename,
        category=category or "general"
    )

    return result
    upload_dir = "knowledge_files"
    os.makedirs(upload_dir, exist_ok=True)

    file_path = os.path.join(upload_dir, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = add_file_to_knowledge_base(
        file_path=file_path,
        title=title or file.filename,
        category=category or "general"
    )

    return result


@app.get("/knowledge/stats")
def knowledge_stats():
    return get_knowledge_stats()


@app.post("/knowledge/search")
def knowledge_search(request: ChatRequest):
    results = search_knowledge_base(request.message, top_k=5)

    return {
        "query": request.message,
        "results": [
            {
                "title": item["title"],
                "file_name": item["file_name"],
                "category": item["category"],
                "score": item["score"],
                "content": item["content"][:700]
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