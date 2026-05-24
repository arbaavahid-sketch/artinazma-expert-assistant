# آرتین آزما — دستیار هوشمند تخصصی

دستیار هوشمند **آرتین** برای پاسخ‌گویی تخصصی در حوزه تجهیزات آزمایشگاهی، تحلیل داده‌های آزمایشگاهی، مواد شیمیایی، کاتالیست‌ها و صنایع نفت، گاز و پتروشیمی.

---

## ساختار پروژه

```
artinazma-expert-assistant/
├── backend/          # FastAPI (Python) — port 8000
│   ├── main.py
│   ├── ai_service.py
│   ├── knowledge_service.py
│   ├── db_service.py
│   ├── requirements.txt
│   └── .env.example  ← کپی کنید به .env و مقادیر را وارد کنید
└── frontend/         # Next.js 16 + React 19 — port 3000
    ├── src/
    │   ├── app/
    │   ├── components/
    │   └── lib/
    ├── package.json
    └── .env.local.example  ← کپی کنید به .env.local و مقادیر را وارد کنید
```

---

## راه‌اندازی

### پیش‌نیازها

- Python 3.10+
- Node.js 18+
- (اختیاری) Qdrant Cloud برای vector search مقیاس‌پذیر

### ۱. بک‌اند (FastAPI)

```bash
cd backend

# ۱. کپی فایل محیطی
cp .env.example .env
# سپس .env را باز کرده و OPENAI_API_KEY، ADMIN_API_KEY و سایر موارد را وارد کنید

# ۲. ایجاد محیط مجازی
python -m venv venv

# ۳. فعال‌سازی (Windows)
.\venv\Scripts\activate
# فعال‌سازی (Linux/Mac)
source venv/bin/activate

# ۴. نصب وابستگی‌ها
pip install -r requirements.txt

# ۵. اجرا (حالت توسعه با hot-reload)
uvicorn main:app --reload --port 8000
```

بک‌اند روی `http://localhost:8000` در دسترس است.
مستندات API: `http://localhost:8000/docs`

### ۲. فرانت‌اند (Next.js)

```bash
cd frontend

# ۱. کپی فایل محیطی
cp .env.local.example .env.local
# سپس .env.local را باز کرده و ADMIN_API_KEY و ADMIN_PASSWORD را وارد کنید

# ۲. نصب وابستگی‌ها
npm install

# ۳. اجرا (حالت توسعه)
npm run dev
```

فرانت‌اند روی `http://localhost:3000` در دسترس است.

---

## دستورات اضافی

```bash
# ساخت فرانت‌اند برای Production
cd frontend && npm run build

# لینت فرانت‌اند
cd frontend && npm run lint

# وارد کردن دسته‌ای فایل‌های دانش
cd backend && python bulk_import_knowledge.py

# تعمیر knowledge vectors
cd backend && python repair_knowledge_vectors.py
```

---

## متغیرهای محیطی مهم

| متغیر | محل | توضیح |
|---|---|---|
| `OPENAI_API_KEY` | backend/.env | کلید API اصلی OpenAI |
| `ADMIN_API_KEY` | backend/.env + frontend/.env.local | کلید ادمین (باید یکسان باشند) |
| `ADMIN_PASSWORD` | frontend/.env.local | رمز ورود به پنل ادمین |
| `QDRANT_URL` | backend/.env | (اختیاری) آدرس Qdrant Cloud |
| `GOOGLE_DRIVE_ROOT_FOLDER_ID` | backend/.env | (اختیاری) ID پوشه Google Drive |

---

## نکات مهم امنیتی

- **هرگز** فایل `.env` یا `google-service-account.json` را commit نکنید.
- `ADMIN_API_KEY` در بک‌اند و فرانت‌اند باید یکسان باشند.
- در Production، `ADMIN_SESSION_TOKEN` را به یک رشته تصادفی قوی تغییر دهید.

---

## وضعیت Health Check

```bash
curl http://localhost:8000/health
```

---

## مجوز

این پروژه متعلق به شرکت **آرتین آزما مهر** است.
