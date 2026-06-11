# راهنمای تست رایگان قبل از راه‌اندازی (Cloudflare Tunnel)

این راهنما برای کسی نوشته شده که با استقرار آشنا نیست. هدف: گرفتن یک آدرس
عمومی (مثل `test.artinazma.net`) که بتوانی از موبایل یا برای مشتری باز کنی —
**بدون اجاره‌ی سرور و بدون تحریم**، چون Cloudflare Tunnel رایگان است و از ایران کار می‌کند.

دو روش داریم: **روش ۱** سریع‌ترین برای یک نگاه فوری، **روش ۲** کامل‌تر و نزدیک به production.

---

## پیش‌نیاز مشترک: نصب cloudflared

روی همان سیستمی که پروژه را اجرا می‌کنی (ویندوز):
1. از سایت Cloudflare فایل `cloudflared` ویندوز را دانلود کن (جستجو: «cloudflared windows download»).
2. آن را در یک پوشه بگذار و در PowerShell همان‌جا برو.

---

## روش ۱ — تست سریع (۵ دقیقه، آدرس موقت)

این روش اپ را در حالت dev اجرا و یک آدرس موقت `*.trycloudflare.com` می‌دهد.
نیازی به حساب Cloudflare یا دامنه ندارد.

**ترمینال ۱ — بک‌اند:**
```
cd D:\artinazma-expert-assistant\backend
.\venv\Scripts\Activate.ps1
uvicorn main:app --port 8000
```
(مطمئن شو `backend\.env` پر است: حداقل `OPENAI_API_KEY` و در صورت نیاز پراکسی.)

**ترمینال ۲ — فرانت‌اند:**
```
cd D:\artinazma-expert-assistant\frontend
npm run dev
```

**ترمینال ۳ — تونل:**
```
cloudflared tunnel --url http://localhost:3000
```
یک آدرس مثل `https://random-words.trycloudflare.com` می‌دهد. همان را در مرورگر/موبایل باز کن.

⚠️ **محدودیت روش ۱:** چون حالت dev است و آدرس بک‌اند ثابت نیست، ممکن است بخش‌هایی
که مستقیم به بک‌اند وصل می‌شوند (استریم چت، WebSocket) درست کار نکنند. برای دیدن
ظاهر، صفحات، `/products` و فرم‌ها عالی است؛ برای تست کاملِ چت، روش ۲ را برو.

---

## روش ۲ — استیجینگ روی زیردامنه‌ی خودت (کامل، رایگان)

چون دامنه‌ی `artinazma.net` را داری، یک زیردامنه‌ی `test.artinazma.net` می‌سازیم که
به سیستم لوکال تو وصل شود. این نزدیک‌ترین حالت به production است.

### گام ۱ — دامنه را به Cloudflare وصل کن (یک‌بار)
1. در `dash.cloudflare.com` ثبت‌نام کن (رایگان).
2. دامنه‌ی `artinazma.net` را Add کن؛ Cloudflare دو nameserver می‌دهد.
3. این nameserverها را در پنل ثبت‌کننده‌ی دامنه‌ات ست کن (اگر دامنه‌ی اصلی در
   حال استفاده است و نمی‌خواهی جابه‌جا شود، این گام را با مسئول فنی دامنه هماهنگ کن).

### گام ۲ — ساخت تونل نام‌دار
در PowerShell:
```
cloudflared login                         # مرورگر باز می‌شود، دامنه را انتخاب کن
cloudflared tunnel create artin-test      # یک تونل می‌سازد و یک فایل credential
cloudflared tunnel route dns artin-test test.artinazma.net
```

### گام ۳ — فایل پیکربندی تونل
یک فایل `config.yml` بساز (مسیرش را cloudflared موقع create نشان می‌دهد) با محتوای:
```
tunnel: artin-test
credentials-file: C:\Users\<شما>\.cloudflared\<tunnel-id>.json
ingress:
  - hostname: test.artinazma.net
    service: http://localhost:80
  - service: http_status:404
```
(اینجا به پورت ۸۰ اشاره می‌کنیم چون استک داکر را پشت nginx اجرا می‌کنیم.)

### گام ۴ — اجرای استک با دامنه‌ی تست
چون آدرس API موقع build داخل فرانت‌اند پخته می‌شود، باید `DOMAIN` را قبل از build ست کنیم:
```
cd D:\artinazma-expert-assistant
# در PowerShell:
$env:DOMAIN="test.artinazma.net"
$env:POSTGRES_PASSWORD="یک-رمز-قوی"
docker compose build frontend
docker compose up -d postgres redis backend frontend nginx
```
⚠️ nginx در این پروژه برای HTTPS تنظیم شده و به گواهی نیاز دارد. چون TLS را
**Cloudflare** فراهم می‌کند، باید nginx را روی حالت HTTP-only بگذاری (پیکربندی
`nginx/nginx.conf` را موقتاً به یک نسخه‌ی بدون `ssl_certificate` و فقط `listen 80;`
تغییر بده) — یا اگر سخت بود، به‌جای nginx مستقیم پورت ۳۰۰۰ را در `config.yml` بده
(`service: http://localhost:3000`) و بک‌اند را جدا اجرا کن.

### گام ۵ — اجرای تونل
```
cloudflared tunnel run artin-test
```
حالا `https://test.artinazma.net` را باز کن — اپ تو روی اینترنت است، با HTTPS واقعی، رایگان.

---

## یادآوری‌های مهم

- **OpenAI از ایران:** مطمئن شو پراکسی در `backend\.env` تنظیم است (کد از قبل پشتیبانی می‌کند).
- **این محیط تست است، نه production:** از دیتابیس/کلیدهای تستی استفاده کن، نه واقعی.
- **هزینه:** Cloudflare Tunnel و یک زیردامنه کاملاً رایگان‌اند.
- **بعد از تست:** برای production واقعی، یک VPS (ترجیحاً ایرانی، بدون تحریم) منطقی‌تر از سرویس‌های رایگان خارجی است.

## اگر گیر کردی
ساده‌ترین کار: **روش ۱** را اجرا کن و آدرس `trycloudflare.com` را همین‌جا برایم بفرست +
بگو کدام بخش کار نکرد؛ قدم‌به‌قدم با هم حلش می‌کنیم.
