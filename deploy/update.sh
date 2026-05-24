#!/usr/bin/env bash
# =============================================================================
# ArtinAzma — اسکریپت آپدیت سریع (بدون نصب مجدد وابستگی‌ها)
# اجرا به عنوان root یا sudo
# =============================================================================
set -euo pipefail

APP_USER="artin"
APP_DIR="/opt/artinazma"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${GREEN}[INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }

[[ $EUID -ne 0 ]] && { echo "sudo لازم است"; exit 1; }

info "=== کپی فایل‌های جدید ==="
rsync -av --exclude='.git' --exclude='node_modules' --exclude='__pycache__' \
    --exclude='venv' --exclude='.next' --exclude='storage' --exclude='uploads' \
    --exclude='knowledge_files' --exclude='.env' \
    "$REPO_DIR/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

info "=== آپدیت وابستگی‌های Python ==="
sudo -u "$APP_USER" bash -c "
    cd $APP_DIR/backend
    source venv/bin/activate
    pip install -q -r requirements.txt
"

info "=== Build فرانت‌اند ==="
# دریافت NEXT_PUBLIC_API_BASE_URL از .env فرانت‌اند یا مستقیم
NEXT_URL=$(grep -r "NEXT_PUBLIC_API_BASE_URL" "$APP_DIR/frontend/.env.production" 2>/dev/null | cut -d= -f2 || echo "")
sudo -u "$APP_USER" bash -c "
    cd $APP_DIR/frontend
    npm ci --prefer-offline --silent
    ${NEXT_URL:+NEXT_PUBLIC_API_BASE_URL=$NEXT_URL} npm run build
"

# کپی static assets
if [[ -d "$APP_DIR/frontend/.next/standalone" ]]; then
    cp -r "$APP_DIR/frontend/.next/static" "$APP_DIR/frontend/.next/standalone/.next/" 2>/dev/null || true
    cp -r "$APP_DIR/frontend/public"       "$APP_DIR/frontend/.next/standalone/"       2>/dev/null || true
fi

info "=== ری‌استارت سرویس‌ها ==="
systemctl restart artin-backend artin-frontend
sleep 3
systemctl is-active --quiet artin-backend  && echo "  ✓ artin-backend  — running" || echo "  ✗ artin-backend  — failed"
systemctl is-active --quiet artin-frontend && echo "  ✓ artin-frontend — running" || echo "  ✗ artin-frontend — failed"

info "آپدیت کامل شد ✓"
