.PHONY: help dev-backend dev-frontend dev lint test build docker-build docker-up docker-down

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
	@echo ""
	@echo "  Build"
	@echo "    make build           Build frontend for production"
	@echo ""
	@echo "  Docker"
	@echo "    make docker-build    Build Docker images for both services"
	@echo "    make docker-up       Start services with docker compose"
	@echo "    make docker-down     Stop and remove containers"
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

# ─── Build ────────────────────────────────────────────────────────────────────
build:
	cd frontend && npm run build

# ─── Docker ───────────────────────────────────────────────────────────────────
docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down
