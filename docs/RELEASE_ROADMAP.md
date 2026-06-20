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

- [ ] Send a real chat request to Artin and verify the answer.
- [ ] Upload a knowledge file from admin.
- [ ] Submit a customer quote/contact request.
- [ ] Verify Telegram and email notifications.
- [ ] Test customer registration/login and multiple chat sessions.
- [ ] Review admin pages: questions, requests, customers, settings, and knowledge.
- [ ] Test important RTL/mobile views.

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

Phase 1 is complete. Continue with Phase 2: prepare and verify production environment variables.
