# نقشه راه بهبود ArtinAzma Expert Assistant

این نقشه راه برای اجرای مرحله به مرحله بهبودهای پروژه است. هر مورد زمانی کامل محسوب می‌شود که تغییر پیاده‌سازی شده، تست/بیلد مرتبط پاس شده، و وضعیت آن در این فایل به‌روزرسانی شده باشد.

## وضعیت فعلی پایه

- Backend tests: 111 passed
- Frontend lint: passed
- Frontend typecheck: passed
- Frontend tests: 18 passed
- Frontend production build: passed
- Working tree before roadmap: clean

## فاز 1: پایه‌های کیفیت و مشاهده‌پذیری

هدف: بتوانیم بفهمیم اپ دقیقاً چطور جواب می‌دهد، کجا خطا دارد، و کیفیت پاسخ‌ها را قابل اندازه‌گیری کنیم.

- [x] 1.1 ثبت متادیتای pipeline چت در پاسخ‌ها و دیتابیس: intent، search mode، best score، web enabled، تعداد منابع
- [x] 1.2 نمایش متادیتای کیفیت پاسخ در پنل ادمین سوالات
- [x] 1.3 ساخت مجموعه سوالات ارزیابی AI با نمونه‌های فارسی/انگلیسی و صنعتی
- [x] 1.4 افزودن اسکریپت اجرای eval آفلاین/نیمه‌آفلاین برای سنجش کیفیت پاسخ‌ها
- [x] 1.5 اضافه کردن گزارش خلاصه eval در docs یا admin

## فاز 2: بهبود RAG و بانک دانش

هدف: پاسخ‌ها دقیق‌تر، کم‌توهم‌تر، و قابل ردیابی‌تر شوند.

- [x] 2.1 صفحه وضعیت فایل‌های دانش: تعداد chunk، دسته‌بندی، وضعیت embedding، آخرین sync
- [x] 2.2 امکان re-index/re-embed انتخابی برای هر فایل دانش
- [x] 2.3 بهبود hybrid search با ترکیب exact model/code، keyword، vector و score قابل توضیح
- [x] 2.4 بهتر کردن نمایش source و citation در چت
- [x] 2.5 گزارش خطا و نتیجه Google Drive sync به شکل قابل فهم در admin

## فاز 3: تجربه کاربری چت

هدف: چت برای مشتری و کارشناس روان‌تر، سریع‌تر و حرفه‌ای‌تر شود.

- [x] 3.1 پایدارسازی streaming/reconnect و دکمه stop/regenerate
- [x] 3.2 جستجو در history چت‌های مشتری
- [x] 3.3 بهبود کارت‌های محصول/دستگاه مرتبط
- [x] 3.4 quick actions بعد از پاسخ: خلاصه، جدول، منابع/اقدام بعدی
- [x] 3.5 بهبود export Word/PDF بدون وابستگی به Google Fonts

## فاز 4: امنیت و production readiness

هدف: deploy، auth، backup و monitor در محیط واقعی قابل اعتماد شوند.

- [ ] 4.1 تست و اصلاح نهایی Docker Compose روی محیطی که Docker دارد
  - وضعیت: اصلاح استاتیک انجام شد؛ backend image برای healthcheck به `curl` مجهز شد و برای frontend healthcheck اضافه شد. تست runtime با `docker compose config/build/up` هنوز به محیط دارای Docker نیاز دارد.
- [x] 4.2 rate limit برای admin login سمت Next.js
- [x] 4.3 health check عمیق برای OpenAI، DB، Qdrant، Google Drive، email
- [x] 4.4 بررسی secrets و جلوگیری از نشت service account در backup/public
  - Status: hardened ignore rules, removed tracked runtime DB/Google Drive files from git index, constrained admin backup downloads/deletes to managed backup files, and added `scripts/check_no_secrets.py`.
- [x] 4.5 تنظیم Sentry یا داشبورد error log
  - Status: Sentry is enabled when `SENTRY_DSN` is configured; added admin-only `/admin/error-log` endpoint and `/admin/error-log` UI for local warning/error log inspection.

## فاز 5: تست E2E و CI کامل‌تر

هدف: مسیرهای اصلی اپ با تست end-to-end پوشش داده شوند و هر تغییر خطرناک زود دیده شود.

- [x] 5.1 Playwright smoke test برای home، login، assistant، admin
  - Status: added Playwright config, local Chrome-based runner, and smoke specs for home, customer login, assistant, and admin login.
- [x] 5.2 E2E مسیر customer login و chat
  - Status: added mocked customer login/session/chat E2E flow that verifies redirect to assistant, chat stream POST, and rendered chat messages.
- [x] 5.3 E2E مسیر admin login و upload knowledge
  - Status: added mocked admin login + knowledge upload E2E flow and isolated E2E dev port/env to avoid stale local server conflicts.
- [x] 5.4 CI برای backend tests، frontend lint/typecheck/test/build
  - Status: CI now includes secret/runtime-file scan, backend lint/tests, frontend typecheck/lint/unit tests/E2E Playwright smoke tests, production build, and gated Docker image build on main.
- [ ] 5.5 smoke test برای Docker image build

## فاز 6: قابلیت‌های کسب‌وکاری

هدف: اپ به ابزار واقعی فروش/پشتیبانی و مدیریت درخواست تبدیل شود.

- [ ] 6.1 workflow درخواست مشتری: جدید، در حال بررسی، قیمت‌گذاری، ارسال‌شده، بسته‌شده
- [ ] 6.2 اعلان ایمیل/تلگرام برای درخواست‌ها و پیام‌های مهم
- [ ] 6.3 فرم quote هوشمند بر اساس نوع دستگاه/مواد/خدمت
- [ ] 6.4 analytics سوالات پرتکرار، محصولات پرتکرار، مشتریان فعال
- [ ] 6.5 خروجی مدیریتی ماهانه از درخواست‌ها و کیفیت پاسخ‌ها

## ترتیب اجرای پیشنهادی

1. شروع از فاز 1، مورد 1.1
2. بعد از هر مورد: اجرای تست مرتبط و گرفتن تایید کاربر
3. بعد از پایان هر فاز: اجرای چک کامل backend/frontend و commit
4. در صورت پیدا شدن blocker، ثبت در همین فایل و رفتن به کوچک‌ترین اصلاح لازم
