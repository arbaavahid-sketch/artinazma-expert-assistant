#!/usr/bin/env bash
# ============================================================
# offsite-sync.sh
# بکاپ‌های لوکال را به ArvanCloud Object Storage منتقل می‌کند
# بعد از artinazma-backup-runner.sh اجرا می‌شود
# ============================================================
set -euo pipefail

BUCKET="arvan:artinazma-backup"
LOG_TAG="[offsite-sync]"

echo "${LOG_TAG} Starting off-site sync — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# ── بکاپ دیتابیس و Qdrant ────────────────────────────────
echo "${LOG_TAG} Syncing database backups..."
rclone sync /opt/artinazma/backups/ "${BUCKET}/db/" \
  --transfers 2 \
  --log-level INFO \
  --stats 0

# ── فایل‌های دانش (knowledge_files) ───────────────────────
if [ -d /opt/artinazma/backend/knowledge_files ]; then
  echo "${LOG_TAG} Syncing knowledge files..."
  rclone sync /opt/artinazma/backend/knowledge_files/ "${BUCKET}/knowledge_files/" \
    --transfers 2 \
    --log-level INFO \
    --stats 0
fi

# ── فایل .env (رمزگذاری‌شده با gzip) ─────────────────────
if [ -f /opt/artinazma/.env ]; then
  echo "${LOG_TAG} Backing up .env..."
  gzip -c /opt/artinazma/.env | \
    rclone rcat "${BUCKET}/config/env_$(date -u +%Y%m%d).env.gz"
fi

echo "${LOG_TAG} ✓ Off-site sync complete — $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# نمایش فضای استفاده‌شده در ArvanCloud
rclone size "${BUCKET}/" --json 2>/dev/null | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(f'${LOG_TAG} ArvanCloud usage: {d[\"bytes\"]/1024/1024:.1f} MB in {d[\"count\"]} files')" || true
