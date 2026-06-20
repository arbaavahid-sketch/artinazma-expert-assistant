"""
Push Notification Service — sends Web Push notifications via pywebpush.
Requires VAPID_PRIVATE_KEY and VAPID_CLAIMS_EMAIL in .env.
"""

import os
import json
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_VAPID_PRIVATE_KEY = os.getenv("VAPID_PRIVATE_KEY", "").strip()
_VAPID_CLAIMS_EMAIL = os.getenv("VAPID_CLAIMS_EMAIL", "").strip()


def _get_vapid_claims() -> dict:
    return {"sub": f"mailto:{_VAPID_CLAIMS_EMAIL}"}


def is_push_configured() -> bool:
    """Return True if VAPID keys are configured."""
    return bool(_VAPID_PRIVATE_KEY and _VAPID_CLAIMS_EMAIL)


def send_push_notification(
    subscription_info: dict,
    title: str,
    body: str,
    url: Optional[str] = None,
    icon: Optional[str] = None,
) -> bool:
    """
    Send a single push notification to a subscription.
    Returns True if successful, False otherwise.
    """
    if not is_push_configured():
        logger.warning("Push not configured — VAPID_PRIVATE_KEY or VAPID_CLAIMS_EMAIL missing")
        return False

    try:
        from pywebpush import webpush

        payload = json.dumps({
            "title": title,
            "body": body,
            "url": url or "/customer-dashboard",
            "icon": icon or "/images/artinazma-logo.png",
        })

        webpush(
            subscription_info=subscription_info,
            data=payload,
            vapid_private_key=_VAPID_PRIVATE_KEY,
            vapid_claims=_get_vapid_claims(),
        )
        return True

    except Exception as e:
        # WebPushException for expired/invalid subscriptions
        logger.error(f"Push notification failed: {e}")
        return False


def send_push_to_customer(customer_id: int, title: str, body: str, url: Optional[str] = None) -> int:
    """
    Send push notification to all subscriptions of a customer.
    Returns number of successfully sent notifications.
    """
    if not is_push_configured():
        return 0

    from db_service import get_push_subscriptions, get_connection

    subscriptions = get_push_subscriptions(customer_id)
    sent = 0
    failed_endpoints = []

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": sub["keys"],
        }
        ok = send_push_notification(subscription_info, title, body, url)
        if ok:
            sent += 1
        else:
            failed_endpoints.append(sub["endpoint"])

    # Clean up failed subscriptions (expired or invalid)
    if failed_endpoints:
        try:
            conn = get_connection()
            for ep in failed_endpoints:
                conn.execute("DELETE FROM push_subscriptions WHERE endpoint = ?", (ep,))
            conn.commit()
            conn.close()
            logger.info(f"Cleaned up {len(failed_endpoints)} expired push subscriptions")
        except Exception as e:
            logger.error(f"Failed to clean up push subscriptions: {e}")

    return sent
