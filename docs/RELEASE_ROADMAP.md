# Release Roadmap

Last updated: 2026-06-20

This roadmap tracks the remaining work needed to move ArtinAzma Expert Assistant from "production-ready codebase" to a confident public release.

## Phase 1 - CI And Test Gate

- [x] Fix failing frontend E2E smoke tests.
- [x] Fix secret scan false positives or placeholder handling.
- [x] Run Python lint locally with `ruff`.
- [x] Clean up frontend ESLint warnings.
- [x] Re-run the core release checks:
  - `frontend`: `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`
  - `backend`: `python -m pytest tests/ -q --tb=short`
  - repo: `python scripts/check_no_secrets.py`

## Phase 2 - Production Environment

- [x] Add a safe env validator:
  - local: `python scripts/check_release_env.py --mode local`
  - production: `python scripts/check_release_env.py --mode production`
- [x] Make local env explicit enough for final local QA:
  - `CSRF_SECRET`
  - `FRONTEND_ORIGINS`
  - `ENVIRONMENT=development`
  - `COOKIE_SECURE=false`
- [ ] Set real production backend secrets:
  - `OPENAI_API_KEY`
  - `ADMIN_API_KEY`
  - `JWT_SECRET`
  - `CSRF_SECRET`
- [ ] Set real frontend/server-side secrets:
  - `ADMIN_PASSWORD`
  - `ADMIN_SESSION_TOKEN`
  - `CUSTOMER_SESSION_SECRET`
- [ ] Configure public deployment values:
  - `DOMAIN`
  - `CERTBOT_EMAIL`
  - `FRONTEND_ORIGINS`
  - `NEXT_PUBLIC_API_BASE_URL`
  - `NEXT_PUBLIC_WS_BASE_URL`
- [ ] Enable production safety settings:
  - `ENVIRONMENT=production`
  - `COOKIE_SECURE=true`
- [ ] Decide and configure optional production services:
  - Sentry
  - Telegram notifications
  - SMTP
  - Qdrant
  - Push notifications

Current local validator result:

- Local check passes with 0 failures.
- Root `.env` is still missing, but that is only a warning for local standalone dev and only needed for local Docker compose.

Current production validator result:

- Blocking: root `.env` is missing, so `POSTGRES_PASSWORD`, `DOMAIN`, `CERTBOT_EMAIL`, and `GRAFANA_PASSWORD` are not verified.
- Blocking: `backend/.env` intentionally still uses local values for `FRONTEND_ORIGINS`, `ENVIRONMENT`, and `COOKIE_SECURE`.
- Ready: backend OpenAI/admin/JWT keys are set, Qdrant is set, and frontend admin/customer session/API/WS values are set.
- Optional warnings: Sentry, Telegram, backend push keys, and frontend VAPID public key are not set.

## Phase 3 - Docker Deployment Smoke

- [ ] Verify Docker is available on the deployment target.
- [ ] Run `docker compose config`.
- [ ] Build and start the full stack.
- [ ] Verify healthchecks for backend, frontend, postgres, redis, qdrant, and nginx.
- [ ] Verify `/api/*`, WebSocket, and SSE routes through nginx.
- [ ] Issue or test TLS certificates with certbot.

## Phase 4 - Backup And Restore

- [ ] Run a manual backup.
- [ ] Restore the backup into a separate database.
- [ ] Document the restore procedure.
- [ ] Confirm retention and backup schedule.

## Phase 5 - Product Smoke Test

- [x] Send a real chat request to Artin and verify the answer.
- [x] Upload a knowledge file from admin.
- [x] Submit a customer quote/contact request.
- [ ] Verify Telegram and email notifications.
- [x] Test customer registration/login and multiple chat sessions.
- [x] Review admin pages: questions, requests, customers, settings, and knowledge.
- [x] Test important RTL/mobile views.

## Phase 6 - Final Content And Legal Review

- [ ] Review company contact details, links, and footer content.
- [ ] Review `/privacy` and `/terms` with legal/business stakeholders.
- [ ] Review product images for duplicate or incorrect matches.
- [ ] Run the full AI quality eval set.
- [ ] Save a release baseline for answer quality.

## Phase 7 - Go Live

- [ ] Point DNS to the production server.
- [ ] Enable production TLS.
- [ ] Run database migrations.
- [ ] Run post-deploy smoke tests.
- [ ] Enable Sentry/Grafana alerts.
- [ ] Monitor the first 24-48 hours after release.

## Current Starting Point

Phase 1 is complete. Local env validation is ready; production values should be filled only when moving from local final QA to deployment.

## Local Smoke Status

- Backend local server: starts on `http://127.0.0.1:8000`.
- Frontend local server: starts on `http://127.0.0.1:3000`.
- Backend health through direct API and frontend proxy: passing.
- Qdrant: connected when backend is run with normal network access.
- OpenAI chat: passing when backend is run with normal network access; sandboxed runs fall back locally because outbound sockets are blocked.
- Public UI routes: home, customer login, admin login, assistant redirect, and offline page are reachable.
- Knowledge stats: passing with Qdrant backend.
- Questions analytics: passing.
- Customer request flow: passing; latest smoke request was created and visible to admin API.
- Technical chat smoke: passing with `answer_mode=ai`, local search context, and sources.
- Customer API flow: passing; registration, login, chat session creation, message save/read, chat-history search, and analytics were verified with a fresh smoke customer.
- Customer frontend flow: passing on `http://localhost:3000`; login reaches `/customer-dashboard` and creates the signed customer session cookie.
- Repeatable local customer smoke: `cd frontend && node scripts/local-customer-smoke.mjs`.
- Admin frontend pages: passing on `http://localhost:3000`; login and 10 protected `/admin/*` pages return 200 with the admin session cookie.
- Admin data endpoints: passing through `/api/admin-proxy`; 17 read-only dashboard, questions, requests, customers, settings, knowledge, backup-list, and error-log endpoints return 200.
- RTL/mobile smoke: passing across 63 public, customer-authenticated, and admin-authenticated route/viewport combinations; no horizontal overflow or console/page errors detected.
- Repeatable local RTL/mobile smoke: `cd frontend && node scripts/local-mobile-rtl-smoke.mjs`.
- Admin knowledge upload smoke: passing; upload, chunk preview, search visibility, audit-log entry, and cleanup were verified through `/api/admin-proxy`.
- Repeatable local knowledge upload smoke: `cd frontend && node scripts/local-knowledge-upload-smoke.mjs`.
- Customer request smoke: passing; request creation, admin visibility, CRM/status update, customer history/detail, customer follow-up update, and notifications were verified.
- Repeatable local customer request smoke: `cd frontend && node scripts/local-customer-request-smoke.mjs`.
- Real Artin chat smoke: passing with `answer_mode=ai`, `question_id=628`, 4561 answer characters, `search_mode=local_fast+openai_web`, and 8 internal sources.
- Repeatable local Artin chat smoke: `cd frontend && node scripts/local-artin-chat-smoke.mjs`.
