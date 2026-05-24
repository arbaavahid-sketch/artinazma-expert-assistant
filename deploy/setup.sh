#!/usr/bin/env bash
# =============================================================================
# ArtinAzma Expert Assistant — Production Setup Script
# اجرا به عنوان root یا با sudo
# =============================================================================
set -euo pipefail

# ── تنظیمات — قبل از اجرا ویرایش کنید ────────────────────────────────────────
DOMAIN="${DOMAIN:-artinazma.net}"
APP_USER="artin"
APP_DIR="/opt/artinazma"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"   # root پروژه

# رنگ‌ها
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── بررسی root ────────────────────────────────────────────────────────────────
[[ $EUID -ne 0 ]] && error "این اسکریپت باید با sudo اجرا شود."

info "=== نصب وابستگی‌های سیستم ==="
apt-get update -qq
apt-get install -y python3 python3-pip python3-venv nodejs npm nginx certbot \
    python3-certbot-nginx curl git sqlite3

# ── ایجاد کاربر سیستمی ────────────────────────────────────────────────────────
if ! id "$APP_USER" &>/dev/null; then
    info "ایجاد کاربر $APP_USER ..."
    useradd --system --shell /bin/bash --home-dir "$APP_DIR" --create-home "$APP_USER"
fi

# ── کپی فایل‌های پروژه ────────────────────────────────────────────────────────
info "=== کپی فایل‌های پروژه به $APP_DIR ==="
mkdir -p "$APP_DIR"
rsync -av --exclude='.git' --exclude='node_modules' --exclude='__pycache__' \
    --exclude='venv' --exclude='.next' \
    "$REPO_DIR/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

# ── بک‌اند: Python venv + وابستگی‌ها ─────────────────────────────────────────
info "=== نصب وابستگی‌های Python ==="
sudo -u "$APP_USER" bash -c "
    cd $APP_DIR/backend
    python3 -m venv venv
    source venv/bin/activate
    pip install --upgrade pip wheel
    pip install -r requirements.txt
"

# ── چک کردن فایل .env ────────────────────────────────────────────────────────
if [[ ! -f "$APP_DIR/backend/.env" ]]; then
    warn "فایل .env در $APP_DIR/backend/ وجود ندارد."
    warn "قبل از راه‌اندازی سرویس، این فایل را ایجاد کنید:"
    cat << 'ENV_EXAMPLE'
OPENAI_API_KEY=sk-...
ADMIN_API_KEY=your-secret-admin-key
OPENAI_MODEL=gpt-4o
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
FRONTEND_ORIGINS=https://YOUR_DOMAIN,https://www.YOUR_DOMAIN
ENV_EXAMPLE
fi

# ── فرانت‌اند: build ──────────────────────────────────────────────────────────
info "=== Build فرانت‌اند Next.js ==="
# تنظیم NEXT_PUBLIC_API_BASE_URL برای production (از طریق nginx /api/)
# اگر API روی همین دامنه باشد:
NEXT_PUBLIC_API_BASE_URL_PROD="https://${DOMAIN}/api"
sudo -u "$APP_USER" bash -c "
    cd $APP_DIR/frontend
    npm ci --prefer-offline
    NEXT_PUBLIC_API_BASE_URL='${NEXT_PUBLIC_API_BASE_URL_PROD}' npm run build
"

# ── Next.js standalone output ─────────────────────────────────────────────────
# next.config.ts باید output: 'standalone' داشته باشد
if [[ -d "$APP_DIR/frontend/.next/standalone" ]]; then
    info "Standalone output یافت شد ✓"
    # کپی static files به standalone
    cp -r "$APP_DIR/frontend/.next/static" "$APP_DIR/frontend/.next/standalone/.next/"
    cp -r "$APP_DIR/frontend/public"       "$APP_DIR/frontend/.next/standalone/"
else
    warn "Standalone output یافت نشد. سرویس frontend با 'npm start' اجرا خواهد شد."
    # در این حالت ExecStart را در artin-frontend.service تغییر دهید به:
    # ExecStart=/usr/bin/npm start
fi

# ── نصب systemd services ──────────────────────────────────────────────────────
info "=== نصب systemd services ==="
DEPLOY_DIR="$REPO_DIR/deploy"
cp "$DEPLOY_DIR/artin-backend.service"  /etc/systemd/system/
cp "$DEPLOY_DIR/artin-frontend.service" /etc/systemd/system/

# جایگزینی مسیر در صورت نیاز به تغییر APP_DIR
sed -i "s|/opt/artinazma|$APP_DIR|g" /etc/systemd/system/artin-backend.service
sed -i "s|/opt/artinazma|$APP_DIR|g" /etc/systemd/system/artin-frontend.service
sed -i "s|User=artin|User=$APP_USER|g" /etc/systemd/system/artin-backend.service
sed -i "s|User=artin|User=$APP_USER|g" /etc/systemd/system/artin-frontend.service

systemctl daemon-reload
systemctl enable artin-backend artin-frontend
info "سرویس‌ها فعال شدند (هنوز start نشده‌اند)"

# ── nginx config ──────────────────────────────────────────────────────────────
info "=== تنظیم nginx ==="
NGINX_CONF="/etc/nginx/sites-available/artinazma"
cp "$DEPLOY_DIR/nginx-site.conf" "$NGINX_CONF"
sed -i "s|YOUR_DOMAIN|$DOMAIN|g" "$NGINX_CONF"

ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/artinazma
rm -f /etc/nginx/sites-enabled/default

nginx -t && info "تنظیمات nginx صحیح است ✓"

# ── SSL با Let's Encrypt ──────────────────────────────────────────────────────
info "=== دریافت گواهی SSL از Let's Encrypt ==="
info "قبل از اجرای certbot، مطمئن شوید DNS دامنه $DOMAIN به این سرور اشاره می‌کند."
read -rp "آیا DNS درست تنظیم شده؟ certbot اجرا شود؟ [y/N] " yn
if [[ "${yn,,}" == "y" ]]; then
    certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos \
        --email "admin@$DOMAIN" --redirect
    info "SSL نصب شد ✓"
    systemctl reload nginx
else
    warn "certbot اجرا نشد. بعداً دستی اجرا کنید:"
    echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN"
fi

# ── ایجاد پوشه‌های storage ────────────────────────────────────────────────────
info "=== ایجاد پوشه‌های storage ==="
sudo -u "$APP_USER" mkdir -p "$APP_DIR/backend/storage" \
                             "$APP_DIR/backend/uploads" \
                             "$APP_DIR/backend/knowledge_files"
chown -R "$APP_USER:$APP_USER" "$APP_DIR/backend/storage" \
                                "$APP_DIR/backend/uploads" \
                                "$APP_DIR/backend/knowledge_files"

# ── شروع سرویس‌ها ─────────────────────────────────────────────────────────────
if [[ -f "$APP_DIR/backend/.env" ]]; then
    info "=== شروع سرویس‌ها ==="
    systemctl start artin-backend
    sleep 3
    systemctl start artin-frontend
    sleep 2
    systemctl reload nginx

    info "بررسی وضعیت سرویس‌ها:"
    systemctl is-active --quiet artin-backend  && echo "  ✓ artin-backend  — running" || echo "  ✗ artin-backend  — failed"
    systemctl is-active --quiet artin-frontend && echo "  ✓ artin-frontend — running" || echo "  ✗ artin-frontend — failed"
    systemctl is-active --quiet nginx          && echo "  ✓ nginx          — running" || echo "  ✗ nginx          — failed"
else
    warn ".env وجود ندارد — سرویس‌ها start نشدند."
    warn "بعد از ایجاد $APP_DIR/backend/.env دستور زیر را اجرا کنید:"
    echo "  systemctl start artin-backend artin-frontend && systemctl reload nginx"
fi

echo ""
info "=== نصب کامل شد ==="
echo ""
echo "  URL اصلی:        https://$DOMAIN"
echo "  URL بک‌اند:       https://$DOMAIN/api/"
echo "  لاگ بک‌اند:      journalctl -u artin-backend -f"
echo "  لاگ فرانت‌اند:   journalctl -u artin-frontend -f"
echo "  لاگ nginx:        tail -f /var/log/nginx/artinazma-error.log"
echo ""
