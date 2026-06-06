# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ArtinAzma Expert Assistant — a bilingual (Persian/English) AI-powered expert chat assistant for **ArtinAzma Mehr**, a company supplying laboratory and analytical equipment, chemicals, catalysts, and process materials to the oil, gas, petrochemical, and refinery industries.

The app has two independently runnable halves:
- **`backend/`** — FastAPI (Python) REST API, runs on port 8000
- **`frontend/`** — Next.js 16 + React 19 app, runs on port 3000

## Development Commands

### Backend

```bash
cd backend

# Activate virtual environment (Windows)
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run dev server (hot-reload)
uvicorn main:app --reload --port 8000

# Run without reload
uvicorn main:app --port 8000
```

The backend requires a `.env` file in `backend/` with at minimum:
- `OPENAI_API_KEY` — required for AI responses and embeddings
- `ADMIN_API_KEY` — required for admin-protected endpoints (`X-Admin-Key` header)
- `OPENAI_MODEL` — defaults to `gpt-5.1`
- `OPENAI_EMBEDDING_MODEL` — defaults to `text-embedding-3-small`
- `FRONTEND_ORIGINS` — comma-separated allowed CORS origins (default: `http://localhost:3000,http://127.0.0.1:3000`)
- `GOOGLE_DRIVE_ROOT_FOLDER_ID` / `GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE` — for Google Drive knowledge sync

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Lint
npm run lint
```

The frontend reads `NEXT_PUBLIC_API_BASE_URL` (defaults to `http://127.0.0.1:8000`) to locate the backend.

## Architecture

### Backend service graph

`main.py` is the FastAPI entry point. Every request flows through a layered pipeline:

1. **Intent detection** (`intent_service.py`) — classifies the question intent (e.g., `technical_general`, `equipment_recommendation`, `troubleshooting`, `lab_analysis`, `sales`)
2. **Knowledge retrieval** — two-tier:
   - **Local fast search** (`local_search_service.py`) — token/keyword scoring against the in-memory vector store; used first for speed
   - **AI vector search** (`knowledge_service.py`) — OpenAI `text-embedding-3-small` embeddings stored in `storage/knowledge_vectors.json`; used when local score is insufficient
3. **Site resource lookup** (`site_resource_service.py`, `artinazma_index_service.py`) — searches a crawled index of artinazma.net for relevant product pages
4. **AI response** (`ai_service.py`) — calls OpenAI Responses API (`client.responses.create`) with optional `web_search_preview` tool for verified answers; the model identity is "آرتین", a specialized Persian/industrial domain expert persona
5. **Persistence** (`db_service.py`) — SQLite at `storage/app.db` for questions, user memories, customer accounts, chat sessions, and customer requests

Key routing logic in `main.py POST /chat`:
- ASTM code detected → skip vector search, use GPT directly
- Specific product/model question with no local match → skip internal context, use GPT + web
- Follow-up transform request ("summarize", "make into table") → skip search entirely, rewrite only from history

### Backend storage layout

```
backend/storage/
  app.db                  # SQLite: questions, customers, memories, sessions
  knowledge_vectors.json  # Embedding vectors + chunked text for all knowledge files
backend/knowledge_files/  # Uploaded PDFs/TXTs that get embedded
backend/uploads/          # Temporary user-uploaded files (Excel, CSV, PDF, images)
```

### Frontend structure

Next.js App Router. All routes are in `frontend/src/app/`. The entire app is wrapped in `ArtinShell` (sidebar + session management).

Key routes:
- `/` — home/landing
- `/assistant` — main AI chat interface
- `/analyze` — file and image analysis (Excel, CSV, PDF, JPG upload)
- `/customer-login`, `/customer-register`, `/customer-dashboard` — customer auth and multi-session chat
- `/customer-request` — contact/quote form
- `/admin`, `/admin/dashboard`, `/admin/questions`, `/admin/knowledge`, `/admin/requests` — admin panel (protected by session cookie set via `/api/admin-login`)
- `/knowledge`, `/questions`, `/memory` — internal tools

All API calls go through `src/lib/api.ts` which reads `NEXT_PUBLIC_API_BASE_URL`.

Admin auth is a Next.js API route cookie check (`src/app/api/admin-status/route.ts`) — the admin key is never exposed to the browser.

### Knowledge base management

- Upload files via `POST /knowledge/upload` (admin-only, sends `X-Admin-Key` header)
- Sync from Google Drive via `POST /knowledge/sync-google-drive`
- Files are chunked (1200 chars, 200 overlap) and embedded → stored in `knowledge_vectors.json`
- `bulk_import_knowledge.py` and `repair_knowledge_vectors.py` are standalone scripts for batch operations

### Important behavioral rules encoded in the backend

- **Web search** uses OpenAI's `web_search_preview` tool and is enabled by default for technical/troubleshooting queries; disabled for follow-up transform requests and `response_mode=brief`
- **Company mentions** (ArtinAzma contact info, links) are only injected into context when the query explicitly references the company or its site
- **Score thresholds**: local search score ≥ 10 → use local results; < 14 for certain intents → discard internal context entirely to avoid polluting the answer with weakly related docs

## Key Technical Notes

- The frontend uses **Next.js 16 with React 19** — APIs and file conventions may differ from older Next.js. Read `node_modules/next/dist/docs/` if unsure (per `frontend/AGENTS.md`).
- The frontend is RTL (`dir="rtl"`, Vazirmatn Persian font) with Tailwind CSS v4.
- The AI model is called via `client.responses.create` (OpenAI Responses API), not `client.chat.completions.create`.
- Rate limiting: `/chat` is limited to 20 requests/minute per IP via `slowapi`.
- Admin-protected endpoints require `X-Admin-Key: <ADMIN_API_KEY>` header.
- Passwords are hashed with `bcrypt`; customer auth is handled entirely in `db_service.py`.
