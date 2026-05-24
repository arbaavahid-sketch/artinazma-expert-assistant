# Frontend — ArtinAzma Expert Assistant

فرانت‌اند پروژه با **Next.js 16** و **React 19** ساخته شده.

برای راهنمای کامل راه‌اندازی، به [README اصلی پروژه](../README.md) مراجعه کنید.

## دستورات سریع

```bash
cp .env.local.example .env.local   # مقادیر را تنظیم کنید
npm install
npm run dev      # http://localhost:3000
npm run build    # ساخت Production
npm run lint     # بررسی کیفیت کد
```

## ساختار پوشه‌ها

```
src/
├── app/                  # Next.js App Router
│   ├── assistant/        # صفحه چت اصلی
│   ├── analyze/          # آنالیز فایل و تصویر
│   ├── admin/            # پنل ادمین (محافظت‌شده)
│   ├── customer-*/       # صفحات مشتری
│   └── api/              # Next.js API Routes
│       ├── admin-login/  # احراز هویت ادمین
│       ├── admin-logout/
│       ├── admin-proxy/  # پروکسی امن برای backend
│       └── admin-status/
├── components/
│   ├── ArtinShell.tsx    # Shell اصلی (sidebar + navigation)
│   └── AppNav.tsx
├── lib/
│   ├── api.ts            # URL builder برای backend
│   ├── user.ts           # مدیریت user ID
│   └── device-assets.ts  # اطلاعات دستگاه‌ها
└── middlew