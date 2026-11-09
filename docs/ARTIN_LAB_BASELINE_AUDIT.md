# ممیزی پایهٔ محیط آزمایشگاهی آرتین | Artin Lab Baseline Audit

تاریخ اجرا: ۲۰۲۶-۱۱-۰۵. مرحلهٔ ۰ نقشهٔ راه: ممیزی کد، فهرست و مثال‌های عددی موجود انجام شد. بازطراحی رابط یا افزودن بانک مواد در این مرحله انجام نشده است.

## موجودی واقعی

منبع قابل بازتولید: `frontend/scripts/audit-laboratory-workspace.cjs`؛ خروجی کامل: `docs/lab-workspace-baseline.json`.

| قلم / Item | تعداد / Count | معنی |
|---|---:|---|
| مدخل کاتالوگ / Catalog entries | ۴۰ | شامل سه ابزار تعریف‌شده در صفحه |
| ابزار نمایان / Visible tools | ۳۴ | مطابق فیلتر واقعی صفحه |
| مدخل قدیمی پنهان / Hidden legacy entries | ۶ | در مدل‌های مستقل عدم‌قطعیت؛ حذف نشدند |
| ردیف بانک روش / Method-bank rows | ۹۸ | نام روش با وضعیت و دامنه؛ نه ۹۸ اجرای کامل استاندارد |
| ردیف با مدل پایهٔ عددی / Numeric base-model rows | ۸۸ | مدل پایه موجود است؛ انطباق با SOP نیاز به بازبینی دارد |
| ردیف کیفی / Qualitative rows | ۹ | نباید نتیجهٔ رده‌ای به U عددی تبدیل شود |
| ردیف نمونه‌برداری / Sampling rows | ۱ | مطالعهٔ جدا از بودجهٔ صرف دستگاه |
| مدل خانواده‌ای / Family models | ۴۶ | یک مدل ممکن است برای چند ردیف کاربرد پایه داشته باشد |
| معادلهٔ ثبت‌شده / Registered equations | ۵۲ | دارایی مشترک رابط و سرور |

دسته‌های نمایان: محلول و غلظت ۱۰، تبدیل واحد ۶، آمار و کنترل کیفیت ۵، جریان و پمپ ۹، خواص فیزیکی ۲، حرارت و انرژی ۱، GUM یک ابزار با چندین مدل داخلی.

## بررسی و شواهد

- رجیستری JSON رابط و سرور برابر بود؛ سازندهٔ دارایی‌ها در حالت `--check` نیز ۵۲ معادله را تأیید کرد.
- مثال اسمی هر ۵۲ معادله پذیرفته شد و حساسیت‌ها متناهی بودند. این بررسی صرفاً صحت ورود مثال و اجرای مدل را نشان می‌دهد.
- تمام مدل‌های ارجاع‌شدهٔ بانک در رجیستری موجودند؛ هیچ ردیف طبقه‌بندی‌شده به عنوان عددی بدون مدل پایه یافت نشد.
- نام انگلیسی هر ۹۸ ردیف وجود دارد. برچسب‌های ورودی فارسی/انگلیسی ابزارهای نمایان هم‌تعدادند و توضیح دو زبانهٔ فرمول برای همهٔ آن‌ها پیدا شد. وجود متن با ممیزی کامل کیفیت ترجمه برابر نیست.
- مجموعهٔ فعلی رابط/مدل: **۱۲ فایل، ۲۴۱ تست پاس**. شامل مدل‌ها، حساسیت‌ها، تغییر زبان، پرونده، خروجی، حدود و فرم GUM است.
- مجموعهٔ فعلی سرور: **۱۹۲ تست پاس و ۲ تست اختیاری Suncal ردشده از اجرا (skipped)**. دو هشدار منسوخ‌شدن وابستگی‌های FastAPI/TestClient و SlowAPI دیده شد؛ شکست تست نبود.
- تست‌ها برخی مسیرها را با API شبیه‌سازی‌شده بررسی می‌کنند. در این مرحله مرورگر و گردش واقعی روی سرور دوباره اجرا نشده‌اند؛ آن‌ها جزء پذیرش رابط جدید خواهند بود.

فرمان‌ها از ریشهٔ مربوط اجرا شدند:

```text
frontend: node scripts/audit-laboratory-workspace.cjs
frontend: node node_modules/vitest/vitest.mjs run src/app/calculators/__tests__
root: backend/venv/Scripts/python.exe backend/eval/build_measurement_registry.py --check
root: backend/venv/Scripts/python.exe -m pytest backend/tests/test_uncertainty.py backend/tests/test_registered_measurement_models.py backend/tests/test_uncertainty_coverage.py -q
```

## تصمیم انتقال و شکاف‌ها

| بخش | تصمیم انتقال | کار لازم |
|---|---|---|
| موتور و مدل‌ها | حفظ و استفاده از اجرای موجود | حفظ نسخه، دامنه و تست مرجع؛ تفکیک مدل پایه از روش کامل |
| شناسهٔ ابزار | حفظ نگاشت فعلی | ابزارهای سریع اکنون به موقعیت در آرایه وابسته‌اند؛ پیش از ذخیرهٔ پروندهٔ جدید شناسهٔ پایدار تعیین شود |
| منابع علمی | تجمیع و پیوند با نسخهٔ مدل | ۲۶ معادله در رجیستری یا مدل خانواده‌ای متناظر، فیلد مرجع مستقیم ندارند؛ بعضی توضیح‌ها و منابع در راهنماهای دیگرند. این «فقدان مرجع یکپارچه» است، نه اثبات بی‌منبع‌بودن همهٔ آن‌ها |
| پروندهٔ GUM | ساخت واردکنندهٔ نسخهٔ فعلی | `artin-gum` نسخهٔ ۱: rows، inputs، gcData، familyData، correlations و graphs حفظ شوند؛ فایل اصلی تغییر نکند |
| دادهٔ خام | مدل دادهٔ مشترک مطالعه | غلظت/پاسخ، تکرارها و اطلاعات دستگاه از مؤلفه‌های بودجه جدا باشند؛ انتقال مشتق‌شده منشأ داشته باشد |
| بانک مواد | ساخت مستقل بر پایهٔ دادهٔ منابع‌دار | صفحه و مدل دادهٔ مستقل در مسیر محاسبات موجود پیدا نشد؛ دادهٔ DataPro به پروژه منتقل نشده است |
| گزارش | حفظ CSV/JSON و افزودن snapshot نسخه‌دار | در محدودهٔ کد بررسی‌شده گزارش PDF رسمی و گردش بازبینی پرونده موجود نیست |
| حدود نتیجه | حفظ مقایسهٔ فعلی | از قاعدهٔ تصمیم با لحاظ عدم‌قطعیت جدا بماند |
| ترجمه و ظاهر | بازطراحی با حفظ داده | دو زبان، خطای ورودی، جدول و واحد در نمونهٔ طراحی بعدی بازبینی شوند |
| مونت‌کارلو | حفظ دامنهٔ پشتیبانی | محدودیت هم‌بستگی/توزیع و نوع مدل هنگام انتقال پنهان نشوند؛ MC تطبیقی در این ممیزی پیاده‌سازی نشده است |

## نمونهٔ بعدیِ طراحی

مرحلهٔ ۱: طراحی صفحهٔ شروع و پروندهٔ مرحله‌ای با مسیر GC-FID کالیبراسیون خارجی و استخراج. ساختار شامل «روش»، «داده‌ها و مدارک»، «کالیبراسیون و بررسی داده»، «بودجه»، «نتیجه و گزارش» است. بخش مواد از ابتدا جای مستقل دارد؛ در نخستین نمونه بانک ساختگی به عنوان بانک آماده نمایش داده نشود.

پذیرش نمونهٔ طراحی: موبایل و دسکتاپ، فارسی و انگلیسی، واحد قابل تشخیص، راهنمای «این عدد را از کجا بردارم؟»، وضعیت ناقص/محاسبه‌شده و تفکیک دادهٔ اندازه‌گیری از مقدار عدم‌قطعیت.

## English summary

The baseline code audit found 34 visible tools, 98 method-bank entries (88 numeric base-model rows, 9 qualitative and 1 sampling), 46 family models and 52 registered equations. Frontend/backend registries match and all registered nominal examples are valid with finite sensitivities. Existing suites passed: 241 frontend/model tests and 192 backend tests; two optional Suncal tests were skipped. This does not validate complete laboratory methods or replace live browser/server acceptance checks.

Reuse the numerical engines and models. Consolidate model provenance (26 equations lack a direct reference field in the audited registry/family records), assign stable tool IDs, migrate existing `artin-gum` v1 files without data loss, and separate raw studies from budgets. The next deliverable is a bilingual responsive design prototype of the guided GC-FID workflow, retaining a clear place for the independent chemical reference library.
