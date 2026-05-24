# ArtinAzma — راهنمای Deploy روی سرور

## پیش‌نیازها

- Ubuntu 22.04 LTS
- دسترسی root یا sudo
- DNS دامنه به IP سرور اشاره کند

---

## نصب اول‌بار (First-time setup)

```bash
git clone <repo-url> /tmp/artinazma-repo
cd /tmp/artinazma-repo

# ایجاد فایل .env بک‌اند
cp backend/.env.example backend/.env   # یا دستی بسازید
nano backend/.env

# اجرای اسکریپت نصب
sudo DOMAIN=artinazma.net bash deploy/setup.sh
```

فایل `.env` باید حداقل شامل موارد زیر باشد:

```env
OPENAI_API_KEY=sk-...
ADMIN_API_KEY=your-secret-key
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
FRONTEND_ORIGINS=https://artinazma.net,https://www.artinazma.net
```

---

## آپدیت (Subsequent updates)

```bash
cd /path/to/repo
git pull

sudo bash deploy/update.sh
```

---

## ساختار فایل‌های deploy

| فایل | کاربرد |
|------|---------|
| `setup.sh` | نصب کامل اول‌بار (apt, venv, nginx, SSL, systemd) |
| `update.sh` | آپدیت سریع بدون نصب مجدد وابستگی‌ها |
| `artin-backend.service` | systemd unit برای FastAPI/uvicorn (port 8000) |
| `artin-frontend.service` | systemd unit برای Next.js standalone (port 3000) |
| `nginx-site.conf` | reverse proxy با SSL، SSE support، `/api/` rewrite |

---

## مدیریت سرویس‌ها

```bash
# وضعیت
systemctl status artin-backend artin-frontend

# ری‌استارت
systemctl restart artin-backend artin-frontend

# لاگ‌های live
journalctl -u artin-backend  -f
journalctl -u artin-frontend -f
tail -f /var/log/nginx/artinazma-error.log
```

---

## معماری

```
اینترنت
    │
    ▼
nginx :443 (SSL)
    ├── /api/*  ──────► FastAPI :8000   (artin-backend)
    ├── /uploads/*  ──► static files directly
    └── /*  ──────────► Next.js  :3000  (artin-frontend)
```

- بک‌اند: `/opt/artinazma/backend/` — uvicorn با ۲ worker
- فرانت‌اند: `/opt/artinazma/frontend/.next/standalone/server.js`
- دیتابیس: `/opt/artinazma/backend/storage/app.db` (SQLite)
- آپلودها: `/opt/artinazma/backend/uploads/`
