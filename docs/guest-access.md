# Guest access

- Anonymous visitors get four accepted text requests across `/chat` and `/chat/stream`.
- `/chat/access` initializes an opaque httpOnly visitor cookie and reports the stored count. The frontend calls it before enabling chat. Quota increments are atomic in the shared database, including simultaneous requests from multiple tabs.
- Reloading, clearing localStorage, creating a new chat, providing contact details, or submitting a customer ID does not reset the allowance or authenticate a visitor.
- Anonymous identity is per browser cookie, not a verified person. Deleting all cookies or switching browsers starts a new allowance. This does not unlock uploads or any account-only endpoint.
- File/image analysis, transcription, TTS, follow-up generation, customer requests and memory access require a valid approved customer session. The account approval policy is unchanged. WebSocket chat requires authentication.
- Analysis ownership and chat identity come from the validated customer token rather than submitted IDs.
- Accepted requests consume a slot even if cancelled or if subsequent processing fails.

Deploy both backend and frontend and run the normal Alembic upgrade (`0007_guest_allowances`) on PostgreSQL. SQLite also creates the allowance table on first access. Use the existing same-origin backend proxy so authentication and guest cookies work in the embedded site widget. Third-party iframe cookie blocking requires a same-site deployment; it must not be worked around by granting anonymous upload access.

Verification: `backend/venv/Scripts/python.exe -m pytest backend/tests/test_guest_access.py -q`; in `frontend`, run `npx tsc --noEmit` and `npx vitest run src/app/assistant/__tests__/GuestControls.test.tsx`.
