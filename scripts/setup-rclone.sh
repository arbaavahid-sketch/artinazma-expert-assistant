#!/usr/bin/env bash
# ============================================================
# setup-rclone.sh
# ArvanCloud Object Storage را برای rclone تنظیم می‌کند
# یک‌بار روی سرور اجرا کن:
#   chmod +x /opt/artinazma/scripts/setup-rclone.sh
#   sudo /opt/artinazma/scripts/setup-rclone.sh
# ============================================================
set -euo pipefail

# نصب rclone اگر نیست
if ! command -v rclone &>/dev/null; then
  echo "[setup] Installing rclone..."
  curl -fsSL https://rclone.org/install.sh | bash
fi

# ایجاد config
mkdir -p /root/.config/rclone

cat > /root/.config/rclone/rclone.conf << 'EOF'
[arvan]
type = s3
provider = Other
access_key_id = b41e3b94-d8d0-496e-9ffb-47d643599526
secret_access_key = 5170a615077aafa6f6c4d71c45f23ef6e2bc0344ec0c8fbb8bc96e7daef8fbff
endpoint = s3.ir-thr-at1.arvanstorage.ir
acl = private
EOF

chmod 600 /root/.config/rclone/rclone.conf

echo "[setup] rclone configured. Testing connection..."
rclone lsd arvan:artinazma-backup && echo "[setup] ✓ Connection to ArvanCloud successful!" || echo "[setup] ✗ Connection failed — check credentials"
