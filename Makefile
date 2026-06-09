.PHONY: help dev-backend dev-frontend dev lint type-check test eval-intent eval-quality build docker-build docker-up docker-down certs-dev certs-prod backup backup-list

# ─── Help ─────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  ArtinAzma Expert Assistant — available targets"
	@echo ""
	@echo "  Development"
	@echo "    make dev-backend     Start FastAPI backend (hot-reload, port 8000)"
	@echo "    make dev-frontend    Start Next.js frontend (port 3000)"
	@echo "    make dev             Start both in parallel"
	@echo ""
	@echo "  Quality"
	@echo "    make lint            Run ESLint on frontend"
	@echo "    make type-check      Run TypeScript type-check on frontend"
	@echo "    make eval-intent     Offline intent-routing eval (no backend needed)"
	@echo "    make eval-quality    Answer-quality eval (needs running backend + OPENAI_API_KEY)"
	@echo ""
	@echo "  Build"
	@echo "    make build           Build frontend for production"
	@echo ""
	@echo "  Docker"
	@echo "    make docker-build    Build Docker images (pass DOMAIN=yourdomain.com for prod)"
	@echo "    make docker-up       Start all services (nginx on :80/:443)"
	@echo "    make docker-down     Stop and remove containers"
	@echo ""
	@echo "  TLS Certificates"
	@echo "    make certs-dev       Generate self-signed cert for localhost dev"
	@echo "    make certs-prod      Issue Let's Encrypt cert  (requires DOMAIN + port 80 open)"

	@echo "                         Example: make certs-prod DOMAIN=artinazma.net CERTBOT_EMAIL=info@artinazma.net"
	@echo ""
	@echo "  Backup"
	@echo "    make backup          Run one-off backup (Postgres + Qdrant -> backup_data volume)"
	@echo "    make backup-list     List files in the backup volume"
	@echo ""

# ─── Development ──────────────────────────────────────────────────────────────
dev-backend:
	cd backend && uvicorn main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

dev:
	$(MAKE) -j2 dev-backend dev-frontend

# ─── Quality ──────────────────────────────────────────────────────────────────
lint:
	cd frontend && npm run lint

type-check:
	cd frontend && npx tsc --noEmit

test:
	cd backend && python -m pytest tests/ -q --tb=short
	cd frontend && npm test

# Offline: checks only intent routing. No backend or API key required.
eval-intent:
	python scripts/run_chat_eval.py

# Live: posts each case to a running backend and grades the real answers with an
# LLM judge. Requires the backend up on :8000 and OPENAI_API_KEY configured.
eval-quality:
	python scripts/run_quality_eval.py

# ─── Build ────────────────────────────────────────────────────────────────────
build:
	cd frontend && npm run build

# ─── Docker ───────────────────────────────────────────────────────────────────
DOMAIN ?= localhost

docker-build:
	DOMAIN=$(DOMAIN) docker compose build

docker-up:
	DOMAIN=$(DOMAIN) docker compose up -d

docker-down:
	docker compose down

# ─── TLS Certificates ─────────────────────────────────────────────────────────
# Dev: self-signed cert valid for localhost (committed to repo for zero-setup dev)
certs-dev:
	@mkdir -p nginx/certs
	openssl req -x509 -nodes -days 3650 \
	    -newkey rsa:2048 \
	    -keyout nginx/certs/privkey.pem \
	    -out    nginx/certs/fullchain.pem \
	    -subj   "/C=IR/ST=Tehran/L=Tehran/O=ArtinAzma/CN=localhost" \
	    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
	@echo "Self-signed cert generated → nginx/certs/"

# Prod: Let's Encrypt via certbot (requires DOMAIN env var and port 80 accessible)
certs-prod:
	@test -n "$(DOMAIN)" || (echo "ERROR: set DOMAIN=yourdomain.com" && exit 1)
	@test -n "$(CERTBOT_EMAIL)" || (echo "ERROR: set CERTBOT_EMAIL=you@example.com" && exit 1)
	DOMAIN=$(DOMAIN) CERTBOT_EMAIL=$(CERTBOT_EMAIL) docker compose --profile certbot run --rm certbot
	@echo "Cert issued → nginx/certs/  — restart nginx: docker compose restart nginx"

# ─── Backup ───────────────────────────────────────────────────────────────────
# Run a one-off backup (PostgreSQL + Qdrant snapshot → backup_data volume)
backup:
	POSTGRES_PASSWORD=$$(grep POSTGRES_PASSWORD .env | cut -d= -f2) \
	docker compose --profile backup run --rm backup

# List backup files stored in the backup_data volume
backup-list:
	docker run --rm -v artinazma-expert-assistant_backup_data:/backups alpine \
	    sh -c "find /backups -type f | sort && echo '' && du -sh /backups"
