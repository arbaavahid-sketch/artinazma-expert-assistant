# ArtinAzma Expert Assistant

A Persian-language AI chat assistant for ArtinAzma Mehr, providing expert technical advice on laboratory equipment, chemicals, catalysts, and industrial analytical instruments.

## Run & Operate

- `artifacts/artinazma: web` workflow — Vite/React frontend (port 21810, path `/`)
- `artifacts/artinazma: python-backend` workflow — FastAPI AI backend (port 8000, path `/python-api`)
- `artifacts/api-server: API Server` workflow — Node.js API for admin auth (port 8080, path `/api`)
- Required secrets: `OPENAI_API_KEY` — used by the Python backend for chat and embeddings

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite (artifacts/artinazma)
- AI Backend: Python 3.11 + FastAPI + uvicorn (backend/)
- Admin API: Express 5 (artifacts/api-server)
- DB: SQLite via db_service.py (backend/storage/app.db)
- Knowledge base: OpenAI embeddings stored in backend/storage/knowledge_vectors.json
- AI: OpenAI gpt-4o via openai Python SDK

## Where things live

- `backend/` — Python FastAPI backend (chat, knowledge, customer endpoints)
- `backend/main.py` — FastAPI app entry point and all route definitions
- `backend/ai_service.py` — OpenAI chat completions and image analysis
- `backend/knowledge_service.py` — OpenAI embeddings and vector store
- `backend/db_service.py` — SQLite schema and all DB operations
- `backend/storage/` — runtime data: app.db, knowledge_vectors.json, uploads/
- `artifacts/artinazma/` — React frontend
- `artifacts/artinazma/src/lib/api.ts` — API base URL configuration
- `artifacts/api-server/` — Node.js Express server (admin login/logout)

## Architecture decisions

- Python FastAPI backend is served at `/python-api` path via Replit proxy (port 8000); the proxy strips the path prefix before forwarding, so FastAPI routes are `/chat`, `/knowledge/stats`, etc.
- `VITE_API_BASE_URL=/python-api` is set as a shared env var so the frontend calls the correct backend path from the browser.
- OpenAI clients in `ai_service.py` and `knowledge_service.py` use lazy initialization (`get_client()`) so the backend starts without the API key present at import time.
- CORS is set to `allow_origins=["*"]` when `FRONTEND_ORIGINS=*` (the default in the python-backend service env), so browser requests from the Vite frontend are accepted.
- SQLite is used for persistence (questions, customer sessions, memories) — stored in `backend/storage/app.db`.

## Product

- Persian-language expert chat assistant ("Artin") specialized in oil/gas/petrochemical lab equipment, analytical instruments, chemicals, and catalysts.
- Supports knowledge base upload (PDFs, TXT) with vector similarity search.
- Customer registration, login, and chat session history.
- Admin panel for reviewing and annotating answered questions.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The python-backend workflow must be started from `/home/runner/workspace/backend` — the run command uses an absolute path for this reason.
- After changing `VITE_API_BASE_URL`, restart the `artifacts/artinazma: web` workflow for Vite to pick up the new env var.
- The knowledge base is empty by default — upload files via the admin panel or POST /knowledge/add-file to enable knowledge-grounded answers.
