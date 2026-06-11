# چک‌لیست نهایی‌سازی و راه‌اندازی — ArtinAzma Expert Assistant
آخرین به‌روزرسانی: ۲۰ خرداد ۱۴۰۵ (2026-06-10)

> وضعیت پایه طبق ممیزی: پروژه از نظر فنی آماده‌ی production است (A−). «نهایی‌سازی»
> عمدتاً یعنی تأیید، پیکربندی، پولیش محتوا و آمادگی عملیاتی — نه ساخت فیچر جدید.
> راهنما: ✅ انجام‌شده · 🔧 این سشن انجام شد · ⬜ مانده (نیاز به اقدام تو)

---

## فاز ۱ — کد و تأیید (روی سیستم تو)

- ⬜ تعمیر گیت: `del .git\index.lock .git\HEAD.lock` سپس `git read-tree HEAD`
- ⬜ build/test کامل فرانت‌اند: `cd frontend && npx tsc --noEmit && npm run lint && npm run test && npm run build`
- ⬜ تست بک‌اند: `cd backend && pytest -q` و `python test_comparison_quick.py`
- ⬜ commit کارهای سشن طبق `docs/SESSION_CHANGES_2026-06-10.md` (۶ گروه)
- ⬜ اجرای مجدد `python enrich_product_images.py` برای پوشش `lintel-pn-10` (تنها عکس جامانده)

## فاز ۲ — پیکربندی production (حیاتی) ⚠️

این کلیدها باید در `.env` سرور ست شوند (طبق `backend/.env.example`):

- ⬜ `OPENAI_API_KEY` — کلید معتبر production
- ⬜ `ADMIN_API_KEY` — کلید قوی و تصادفی
- ⬜ `JWT_SECRET` و `CSRF_SECRET` — **حتماً ست شوند** (وگرنه هر ری‌استارت توکن‌ها را بی‌اعتبار می‌کند)
- ⬜ `DATABASE_URL` — رشته‌ی اتصال PostgreSQL (نه SQLite در prod)
- ⬜ `COOKIE_SECURE=true` و `ENVIRONMENT=production`
- ⬜ `FRONTEND_ORIGINS` — دامنه‌ی واقعی (برای CORS)
- ⬜ `SENTRY_DSN` — برای ردیابی خطا
- ⬜ `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` — تست کن یک پیام واقعی برسد
- ⬜ تنظیمات SMTP در پنل ادمین (برای ایمیل تأیید/هشدار) — تست ارسال
- ⬜ `QDRANT_URL` (اگر Qdrant فعال می‌شود) و `VAPID_*` (اگر push فعال است)

## فاز ۳ — داده و محتوا

- ✅ بانک دانش (knowledge_vectors) و کاتالوگ ۷۳ محصول موجود
- 🔧 عکس محصولات به‌صورت محلی دانلود شد (`/product-images/`)
- ⬜ بازبینی چند عکس مشترک/نامربوط در `product-images.json` (مثلاً افزودنی‌ها که `mdea` مشترک دارند) و جایگزینی دستی در صورت نیاز
- ⬜ اجرای کامل eval کیفیت روی هر ۱۶ کیس و ثبت baseline (الان فقط ۳ کیس judged شده)
- ⬜ بازبینی نهایی اطلاعات تماس شرکت در فرم و فوتر

## فاز ۴ — صفحات و UX نهایی

- 🔧 صفحه‌ی ۴۰۴ سفارشی (`app/not-found.tsx`)
- 🔧 صفحه‌ی خطا (`app/error.tsx`)
- ✅ حالت offline (PWA) موجود
- 🔧 **صفحه‌ی حریم خصوصی (`/privacy`) و شرایط استفاده (`/terms`)** ساخته شد + لینک در فوتر سایدبار + sitemap. ⬜ **باید توسط مشاور حقوقی بازبینی شود** (متن نمونه است).
- ⬜ یک پاس کامل موبایل/RTL روی صفحات سنگین admin

## فاز ۵ — عملیات و پایش

- ✅ Health check: `/health` و `/admin/deep-health`
- ✅ مانیتورینگ: Prometheus + Grafana در docker-compose
- ✅ بکاپ خودکار PostgreSQL (سرویس `backup`)
- ⬜ **تست واقعی restore بکاپ** (بکاپی که تست نشده = بکاپ نیست)
- ⬜ تنظیم alert در Grafana/Sentry برای خطاهای ۵xx و down شدن سرویس
- ⬜ بررسی داشبوردهای Grafana بعد از استقرار

## فاز ۶ — استقرار (Go-Live)

- ⬜ DNS دامنه به سرور اشاره کند (`DOMAIN`، `CERTBOT_EMAIL` در env)
- ⬜ صدور گواهی TLS با certbot (سرویس در compose هست)
- ⬜ اجرای `deploy/setup.sh` یا `docker compose up -d`
- ⬜ بررسی systemd serviceها (`artin-backend.service`, `artin-frontend.service`) اگر بدون داکر مستقر می‌شوی
- ⬜ تأیید `nginx-site.conf` (هدرهای امنیتی، redirect به https)

## فاز ۷ — پس از راه‌اندازی (Smoke Test)

- ⬜ یک چت واقعی بزن (پاسخ + کارت دستگاه + استعلام)
- ⬜ یک درخواست استعلام ثبت کن و تأیید کن تلگرام + ایمیل به ادمین رسید
- ⬜ ورود/ثبت‌نام مشتری و چند سشن چت
- ⬜ پنل ادمین: مشاهده‌ی سوالات، درخواست‌ها، بانک دانش
- ⬜ صفحه‌ی `/products` روی موبایل و دسکتاپ
- ⬜ تست ۴۰۴ (یک URL نامعتبر) و بازیابی از خطا

---

## اولویت‌بندی نهایی (اگر وقت محدود است)

**نباید بدون این‌ها لایو کرد:** فاز ۲ کامل (اسرار/DB/CORS)، تست restore بکاپ، smoke test پایه (فاز ۷).

**خیلی مهم ولی نه مسدودکننده:** صفحه‌ی حریم خصوصی، alertها، eval کامل.

**بعد از لایو، تدریجی:** پولیش موبایل admin، بازبینی عکس‌ها، شکستن فایل‌های بزرگ.
