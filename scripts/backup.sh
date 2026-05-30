#!/usr/bin/env sh
# ArtinAzma backup script
# Backs up PostgreSQL (pg_dump) and Qdrant (snapshot API).
# Keeps the last KEEP_DAYS days of backups (default: 7).
#
# Environment variables (all have defaults for docker-compose):
#   DATABASE_URL   - PostgreSQL connection string
#   QDRANT_URL     - Qdrant base URL (default: http://qdrant:6333)
#   QDRANT_COLLECTION - Qdrant collection name (default: knowledge)
#   BACKUP_DIR     - Where to store backups (default: /backups)
#   KEEP_DAYS      - Days of backups to retain (default: 7)

set -e

QDRANT_URL="${QDRANT_URL:-http://qdrant:6333}"
QDRANT_COLLECTION="${QDRANT_COLLECTION:-knowledge}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${KEEP_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%d_%H%M%S)"

mkdir -p "${BACKUP_DIR}/postgres" "${BACKUP_DIR}/qdrant"

echo "[backup] Starting backup — ${TIMESTAMP}"

# ── PostgreSQL ────────────────────────────────────────────────────────────────
if [ -n "${DATABASE_URL}" ]; then
  PGFILE="${BACKUP_DIR}/postgres/artinazma_${TIMESTAMP}.sql.gz"
  echo "[backup] PostgreSQL → ${PGFILE}"
  pg_dump "${DATABASE_URL}" | gzip > "${PGFILE}"
  echo "[backup] PostgreSQL done ($(du -sh "${PGFILE}" | cut -f1))"
else
  echo "[backup] DATABASE_URL not set — skipping PostgreSQL backup"
fi

# ── Qdrant ────────────────────────────────────────────────────────────────────
echo "[backup] Qdrant snapshot → collection: ${QDRANT_COLLECTION}"
SNAP_RESP="$(curl -sf -X POST "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots" 2>&1)" || {
  echo "[backup] WARNING: Qdrant snapshot request failed: ${SNAP_RESP}"
  SNAP_RESP=""
}

if [ -n "${SNAP_RESP}" ]; then
  # Extract snapshot name from JSON response: {"result":{"name":"..."},...}
  SNAP_NAME="$(echo "${SNAP_RESP}" | grep -o '"name":"[^"]*"' | head -1 | sed 's/"name":"//;s/"//')"
  if [ -n "${SNAP_NAME}" ]; then
    SNAP_FILE="${BACKUP_DIR}/qdrant/qdrant_${TIMESTAMP}.snapshot"
    curl -sf "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots/${SNAP_NAME}" \
         -o "${SNAP_FILE}"
    echo "[backup] Qdrant done ($(du -sh "${SNAP_FILE}" | cut -f1))"
    # Delete the snapshot from Qdrant server (we have the file)
    curl -sf -X DELETE \
         "${QDRANT_URL}/collections/${QDRANT_COLLECTION}/snapshots/${SNAP_NAME}" \
         > /dev/null || true
  else
    echo "[backup] WARNING: Could not parse snapshot name from Qdrant response"
  fi
fi

# ── Rotate old backups ────────────────────────────────────────────────────────
echo "[backup] Rotating backups older than ${KEEP_DAYS} days"
find "${BACKUP_DIR}/postgres" -name "*.sql.gz"    -mtime "+${KEEP_DAYS}" -delete
find "${BACKUP_DIR}/qdrant"   -name "*.snapshot"  -mtime "+${KEEP_DAYS}" -delete

echo "[backup] Done — files in ${BACKUP_DIR}:"
ls -lh "${BACKUP_DIR}/postgres/" "${BACKUP_DIR}/qdrant/" 2>/dev/null || true
