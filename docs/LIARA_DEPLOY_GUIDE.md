# راهنمای استقرار روی لیارا — ArtinAzma Expert Assistant
برای تست چندروزه‌ی مدیران. سه بخش: دیتابیس (انجام‌شده ✅)، بک‌اند، فرانت‌اند.

> این بخش فنی‌ترین قسمت کاره. اگر گیر کردی، چند ساعت کمکِ یک برنامه‌نویس
> اینجا را خیلی سریع‌تر می‌کند. بقیه‌ی کارها (دیتابیس، آماده‌سازی کد) انجام شده.

---

## ۰) چیزهایی که از قبل آماده‌ست
- **دیتابیس PostgreSQL** ساخته شد. رشته‌ی اتصال (عمومی):
  `postgresql://root:<رمز>@siah-kaman.liara.cloud:33017/postgres`
- **سرویس هوش مصنوعی لیارا** ساخته شد:
  - Base URL: `https://ai.liara.ir/api/6a2cdbfd47f87dfcae13a92b/v1`
  - Model: `openai/gpt-5`
  - API Key: همان که در لیارا ساختی.

## ۱) نصب ابزار لیارا (یک‌بار)
در PowerShell:
```
npm install -g @liara/cli
liara login
```

## ۲) استقرار بک‌اند
```
cd D:\artinazma-expert-assistant\backend
liara deploy
```
- وقتی پرسید: یک اپ جدید بساز، اسم: `artin-backend`، پلتفرم: **docker** (چون Dockerfile داریم)، پورت: **8000**.

سپس در پنل لیارا → اپ `artin-backend` → بخش **«متغیرهای محیطی»** این‌ها را اضافه کن:
```
ENVIRONMENT=production
DATABASE_URL=postgresql://root:<رمز-دیتابیس>@siah-kaman.liara.cloud:33017/postgres
OPENAI_BASE_URL=https://ai.liara.ir/api/6a2cdbfd47f87dfcae13a92b/v1
OPENAI_API_KEY=<کلید-هوش-مصنوعی-لیارا>
OPENAI_MODEL=openai/gpt-5
ADMIN_API_KEY=<یک-رمز-قوی-بساز>
JWT_SECRET=<یک-رشته-تصادفی-بلند>
CSRF_SECRET=<یک-رشته-تصادفی-بلند-دیگر>
COOKIE_SECURE=true
FRONTEND_ORIGINS=https://artin-frontend.liara.run
```
> نکته: `OPENAI_PROXY` یا VPN لازم نیست — چون از درگاه لیارا استفاده می‌کنیم.

**ساخت جدول‌های دیتابیس (مهم):** بعد از اولین استقرار، در پنل لیارا → اپ بک‌اند →
**«کنسول/ترمینال»** را باز کن و اجرا کن:
```
alembic upgrade head
```
(اگر خطا داد یا دستور نبود، همان‌جا بگو تا راه جایگزین بدهم.)

## ۳) استقرار فرانت‌اند
چون آدرس بک‌اند هنگام build داخل فرانت‌اند پخته می‌شود، اول باید آدرس بک‌اند را بدانیم
(بعد از استقرار بک‌اند، چیزی شبیه `https://artin-backend.liara.run` می‌شود).

```
cd D:\artinazma-expert-assistant\frontend
liara deploy
```
- اسم: `artin-frontend`، پلتفرم: **next**.

سپس در پنل لیارا → اپ `artin-frontend` → **متغیرهای محیطی**:
```
NEXT_PUBLIC_API_BASE_URL=https://artin-backend.liara.run
NEXT_PUBLIC_WS_BASE_URL=wss://artin-backend.liara.run
```
و یک‌بار دوباره دیپلوی کن تا این آدرس‌ها در build اعمال شوند.

## ۴) تست نهایی (Smoke Test)
آدرس فرانت‌اند (`https://artin-frontend.liara.run`) را باز کن و:
- یک چت بزن → باید آرتین جواب بدهد (از طریق هوش مصنوعی لیارا).
- `/products` را ببین → کاتالوگ و عکس‌ها.
- یک درخواست استعلام ثبت کن.
- پنل ادمین را با `ADMIN_API_KEY` چک کن.

این آدرس را به مدیران بده تا چند روز تست کنند. ✅

## نکات مهم
- **هزینه:** پلن‌های کوچک + توکن هوش مصنوعی برای چند روز کم است؛ ولی مصرف توکن را در پنل لیارا چک کن.
- **اسرار:** `JWT_SECRET`/`CSRF_SECRET` را حتماً ست کن (رشته‌های تصادفی بلند).
- **embedding:** اگر درگاه لیارا embedding نداشته باشد، جستجوی بانک دانش به حالت ساده برمی‌گردد (کد محافظت‌شده) و چت سالم می‌ماند.
- **اگر جایی خطا دیدی:** متن دقیق خطا را بفرست؛ همان لحظه حلش می‌کنیم.
