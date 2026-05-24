"""
Telegram notification service for ArtinAzma.

Set these environment variables to enable:
  TELEGRAM_BOT_TOKEN   — your bot token from @BotFather
  TELEGRAM_CHAT_ID     — chat/channel ID to send messages to

If either is missing, all calls are silently ignored.
"""

import logging
import os
import threading
import urllib.request
import urllib.parse
import json

logger = logging.getLogger("artin_telegram")


def _get_token() -> str:
    return os.getenv("TELEGRAM_BOT_TOKEN", "").strip()


def _get_chat_id() -> str:
    return os.getenv("TELEGRAM_CHAT_ID", "").strip()


def is_enabled() -> bool:
    return bool(_get_token() and _get_chat_id())


def _send(text: str) -> None:
    """Blocking HTTP call to Telegram — run this in a background thread."""
    token = _get_token()
    chat_id = _get_chat_id()
    if not token or not chat_id:
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML",
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status != 200:
                logger.warning("Telegram returned status %s", resp.status)
    except Exception as exc:
        logger.warning("Telegram notification failed: %s", exc)


def send_message(text: str) -> None:
    """Fire-and-forget Telegram notification (non-blocking)."""
    if not is_enabled():
        return
    thread = threading.Thread(target=_send, args=(text,), daemon=True)
    thread.start()


# ─── Pre-formatted notification helpers ────────────────────────────────────

def notify_new_customer(full_name: str, email: str, company: str = "") -> None:
    company_line = f"\n🏢 شرکت: {company}" if company else ""
    send_message(
        f"🆕 <b>مشتری جدید ثبت‌نام کرد</b>\n"
        f"👤 نام: {full_name}\n"
        f"📧 ایمیل: {email}"
        f"{company_line}"
    )


def notify_new_request(
    full_name: str,
    company: str,
    phone: str,
    subject: str,
    request_type: str,
) -> None:
    send_message(
        f"📬 <b>درخواست جدید از مشتری</b>\n"
        f"👤 {full_name} — {company}\n"
        f"📞 {phone}\n"
        f"🏷️ نوع: {request_type}\n"
        f"📝 موضوع: {subject}"
    )
