# برنامه بهبود ArtinAzma Expert Assistant

تهیه‌شده: ۱۴۰۵/۰۳/۲۰ (2026-06-10). بر اساس بررسی کامل کدبیس.

> وضعیت پایه خوب است: CI کامل (ruff, pip-audit, npm-audit, tsc, eslint, vitest, playwright, docker smoke)، Sentry، TS strict، dark mode، design tokens، فونت responsive. این موارد «خوب → عالی» هستند نه رفع بحران.

## اولویت ۱ — کارهای سریع و کم‌ریسک

- [x] commit کردن بهبودهای aria در ChatComposer/HeroComposer
- [ ] commit کردن ۳ فایل تست untracked (`api.test.ts`, `user.test.ts`, `device-assets.test.ts`) — پس از تعمیر index گیت
- [ ] تعمیم الگوی `aria-label` به دکمه‌های آیکونی بقیه اپ: `AppNav`, `ArtinShell` (دکمه‌های سایدبار), `Toast` (بستن), `UploadModal`, `AdminGlobalSearch`
- [ ] افزودن `aria-hidden="true"` به همه آیکون‌های تزئینی داخل دکمه‌های دارای label
- [ ] افزودن skip-to-content link در `layout.tsx`
- [ ] مهاجرت آواتارهای استاتیک (`/images/artin-avatar.png`) به `next/image` در customer-login، customer-register، ArtinShell (تصاویر داینامیک/blob دست‌نخورده بمانند)

## اولویت ۲ — شکستن فایل‌های غول‌پیکر (بیشترین تأثیر بر نگهداری)

هدف: هیچ فایل صفحه/سرویس بالای ~۴۰۰ خط نباشد.

- [ ] `assistant/page.tsx` (۱۵۶۷ خط) → استخراج هوک‌ها: `useChatSession`, `useChatStream`, `useVoiceInput`, `useImageUpload`؛ و کامپوننت‌های `ChatMessageList`, `ChatHeader`
- [ ] `admin/knowledge/page.tsx` (۱۶۵۰ خط) → جدا کردن جدول فایل‌ها، فرم آپلود، پنل وضعیت embedding
- [ ] `admin/dashboard/page.tsx` (۱۵۲۴ خط) → استخراج کارت‌های آمار و چارت‌ها به کامپوننت
- [ ] `customer-dashboard/page.tsx` (۱۲۷۰ خط) → جدا کردن لیست سشن‌ها و پنل چت
- [ ] `ai_service.py` (۱۰۰۰ خط) → تفکیک ساخت prompt، فراخوانی مدل، post-processing به ماژول‌های جدا
- [ ] `routes/admin.py` (۹۷۰ خط) → تقسیم به sub-routerها بر اساس دامنه

روش: یک فایل در هر PR، بعد از هر کدام `npm run build` و `pytest` سبز شود.

## اولویت ۳ — عملکرد و مقیاس‌پذیری

- [ ] لایه کش بک‌اند: `functools.lru_cache` یا Redis برای embedding سؤالات پرتکرار و نتایج جستجو (کاهش هزینه OpenAI + تأخیر)
- [ ] فعال‌سازی Qdrant در production (`qdrant_service.py` آماده است) به‌جای لود کامل `knowledge_vectors.json` (~۵.۸MB) در حافظه
- [ ] بررسی `React.memo`/`useMemo`/`useCallback` در لیست پیام‌ها و کارت‌ها (فعلاً فقط ۶ فایل از useMemo استفاده می‌کنند) برای کاهش re-render
- [ ] code-splitting صفحات سنگین admin با dynamic import

## اولویت ۴ — تست و تجربه کاربری

- [ ] افزایش پوشش تست فرانت‌اند (فعلاً ۶ فایل در برابر ~۲۱هزار خط): تست منطق چت در `assistant/page.tsx`
- [ ] skeleton loading برای کارت محصول و تاریخچه چت به‌جای اسپینر ساده
- [ ] empty stateهای طراحی‌شده برای لیست‌های خالی
- [ ] پاس کامل موبایل/RTL روی صفحات admin سنگین
- [ ] اجرای منظم eval کیفیت پاسخ و ردیابی regression (زیرساختش در ROADMAP ساخته شده)

## بهداشت گیت

- تاریخچه شلوغ: ده‌ها commit با پیام یکسان «Improve assistant chat experience». از این به بعد پیام معنادار و atomic.
- نکته مهم: عملیات گیت را فقط از ترمینال ویندوز خودت اجرا کن، نه از محیط دستیار (mount لینوکسی نمی‌تواند فایل‌های قفل `.git` را مدیریت کند).
