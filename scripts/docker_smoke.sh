#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed or not available in PATH." >&2
  exit 127
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is not available. Install Docker Desktop or the compose plugin." >&2
  exit 127
fi

export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-artinazma_smoke_password}"
export DOMAIN="${DOMAIN:-localhost}"
export CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@example.com}"

created_backend_env=0
if [ ! -f backend/.env ]; then
  created_backend_env=1
  cat > backend/.env <<'EOF'
OPENAI_API_KEY=sk-docker-smoke-placeholder
ADMIN_API_KEY=docker-smoke-admin-key
JWT_SECRET=docker-smoke-jwt-secret
OPENAI_MODEL=gpt-5.1
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
FRONTEND_ORIGINS=http://localhost,http://127.0.0.1
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=
EOF
fi

cleanup() {
  docker compose down --remove-orphans
  if [ "$created_backend_env" = "1" ]; then
    rm -f backend/.env
  fi
}
trap cleanup EXIT

wait_for_health() {
  local container="$1"
  local label="$2"
  local attempts="${3:-60}"

  for _ in $(seq 1 "$attempts"); do
    status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container" 2>/dev/null || true)"
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      echo "$label is $status"
      return 0
    fi
    sleep 3
  done

  echo "$label did not become healthy in time." >&2
  docker compose ps
  docker compose logs --tail=120 "$label" || true
  return 1
}

echo "Validating docker-compose.yml..."
docker compose config >/dev/null

echo "Building backend and frontend images..."
docker compose build backend frontend

echo "Starting core services..."
docker compose up -d postgres redis qdrant backend frontend

wait_for_health artin_postgres postgres
wait_for_health artin_redis redis
wait_for_health artin_qdrant qdrant
wait_for_health artin_backend backend
wait_for_health artin_frontend frontend

echo "Checking backend health endpoint..."
docker compose exec -T backend curl -fsS http://localhost:8000/health >/dev/null

echo "Checking frontend HTTP response..."
docker compose exec -T frontend node -e "fetch('http://localhost:3000').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

echo "Checking migrated database schema..."
docker compose exec -T backend python -c "from db_service import get_connection; c=get_connection(); c.execute('SELECT COUNT(*) FROM expert_questions').fetchone(); c.close()"

echo "Docker smoke test passed."
