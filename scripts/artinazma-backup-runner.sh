#!/usr/bin/env bash
set -Eeuo pipefail

export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

cd /opt/artinazma

exec /usr/bin/flock -n /run/artinazma-backup.lock \
  /usr/bin/docker compose --profile backup run --rm backup
