# تغییرات سشن — ۲۰ خرداد ۱۴۰۵ (2026-06-10)

راهنمای commit و تأیید کارهای این سشن. هر بخش یک commit پیشنهادی است.
قبل از شروع، گیت را تعمیر کن:

```
cd D:\artinazma-expert-assistant
del .git\index.lock .git\HEAD.lock
git read-tree HEAD
```

تأیید کلی پیش از commit:
```
cd frontend && npx tsc --noEmit && npm run lint && npm run test && npm run build
cd ..\backend && .\venv\Scripts\Activate.ps1 && python test_comparison_quick.py && pytest -q
```

---

## Commit 1 — fix: نمایش دوباره‌ی کارت دستگاه + CTAهای تبدیل لید

رفع regression: کارت‌های «دستگاه مرتبط» محاسبه می‌شدند ولی رندر نمی‌شدند؛ و
مسیر چت متنی اصلاً `relatedDevices` نمی‌ساخت. به‌علاوه دکمه‌ی «استعلام قیمت»
(با pre-fill فرم) و «مشاهده محصول» (لینک واقعی) اضافه شد.

- `frontend/src/app/assistant/RelatedDeviceCards.tsx` (جدید)
- `frontend/src/components/MessageBubble.tsx`
- `frontend/src/app/assistant/page.tsx`
- `frontend/src/lib/device-assets.ts`
- `frontend/src/app/customer-request/page.tsx`

پیام: `fix: restore related-device cards and add quote/product CTAs`

## Commit 2 — feat: صفحه‌ی کاتالوگ محصولات با عکس واقعی

فهرست کامل ۷۳ محصول از ایندکس سایت + صفحه‌ی `/products` با جستجو و عکس،
به‌علاوه‌ی اسکریپت استخراج عکس و افزودن به sitemap و منوی کناری.

- `frontend/src/lib/products-catalog.ts` (جدید)
- `frontend/src/lib/product-images.json` (جدید — با اجرای اسکریپت پر شد)
- `frontend/src/app/products/page.tsx` (جدید)
- `frontend/src/app/sitemap.ts`
- `frontend/src/components/ArtinShell.tsx`
- `frontend/src/lib/i18n/fa.json`, `frontend/src/lib/i18n/en.json`
- `backend/enrich_product_images.py` (جدید)

پیام: `feat: add product catalog page with images and quote CTAs`

## Commit 3 — refactor: استخراج هوک‌ها از صفحه‌ی دستیار

کاهش حجم `assistant/page.tsx` (۱۵۶۷ → ~۱۳۷۵ خط) با انتقال منطق به هوک‌های
قابل‌استفاده‌ی مجدد و قابل‌تست. رفتار بدون تغییر.

- `frontend/src/hooks/useStagedImage.ts` (جدید)
- `frontend/src/hooks/useScrollToBottom.ts` (جدید)
- `frontend/src/hooks/useCustomerChatSession.ts` (جدید)
- `frontend/src/lib/customer.ts` (جدید)
- `frontend/src/app/assistant/page.tsx`
- تست‌ها: `frontend/src/hooks/__tests__/*`, `frontend/src/lib/__tests__/customer.test.ts`

پیام: `refactor: extract staged-image, scroll, and customer-session hooks`

## Commit 4 — fix: شبکه‌ی ایمنی جدول مقایسه + روش‌های گوگرد ASTM

تابع `ensure_comparison_table` به pipeline وصل شد (قبلاً تعریف بود ولی صدا
زده نمی‌شد)، و کدهای ASTM گوگرد (D2622→WDXRF, D4294→EDXRF) به مقایسه نگاشت
شدند. رفع تنها ضعف کیفیتِ اندازه‌گیری‌شده‌ی eval.

- `backend/comparison_table_service.py`
- `backend/ai_service.py`
- `backend/test_comparison_quick.py` (جدید)

پیام: `fix: wire comparison-table fallback and map ASTM sulfur methods`

## Commit 5 — a11y: aria-label روی کامپوننت‌های مشترک

- `frontend/src/components/Toast.tsx`
- `frontend/src/components/UploadModal.tsx`
- `frontend/src/components/AdminGlobalSearch.tsx`
- `frontend/src/components/ArtinShell.tsx` (دکمه‌ی خروج)

پیام: `a11y: add aria labels to shared icon buttons and dialog`

## Commit 6 — test: تست‌های واحد اولیه (untracked از ابتدای سشن)

- `frontend/src/lib/__tests__/api.test.ts`
- `frontend/src/lib/__tests__/user.test.ts`
- `frontend/src/lib/__tests__/device-assets.test.ts`

پیام: `test: add unit tests for api, user id, and device-asset matching`

---

## یافته‌های مهم (که نیازی به ساخت نداشتند چون از قبل کامل بودند)

- **لینک محصول در پاسخ AI**: `find_artinazma_resources` زنده سایت را جستجو و
  کارت محصول با عکس نشان می‌دهد. کامل است.
- **اعلان لید به ادمین**: هنگام ثبت درخواست، تلگرام + ایمیل هشدار به ادمین و
  ایمیل تأیید به مشتری ارسال می‌شود. (`routes/customers.py` → `notify_new_request`).
  فقط مطمئن شو `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` و SMTP در تنظیمات معتبرند.
- **کش پاسخ، SEO (metadata/sitemap/robots/structured-data)، Sentry، CI**: همگی موجود.
