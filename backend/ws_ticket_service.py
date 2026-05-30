"""
Short-lived WebSocket ticket store.

Instead of passing the JWT in the WebSocket URL (where it appears in server logs),
the client POSTs to /customers/ws-ticket, receives a random one-time ticket, and
passes that ticket as ?ticket=<ticket> when opening the WebSocket connection.

The ticket is consumed immediately on first use and expires in WS_TICKET_TTL seconds.
"""

import secrets
import time
from typing import Optional

WS_TICKET_TTL = 30  # seconds

# { ticket: (customer_id, email, expires_at) }
_store: dict[str, tuple[int, str, float]] = {}


def create_ticket(customer_id: int, email: str) -> str:
    """Create a new one-time ticket for the given customer. Returns the ticket string."""
    _purge_expired()
    ticket = secrets.token_urlsafe(32)
    _store[ticket] = (customer_id, email, time.monotonic() + WS_TICKET_TTL)
    return ticket


def consume_ticket(ticket: str) -> Optional[dict]:
    """
    Validate and consume a ticket.
    Returns {"customer_id": ..., "email": ...} on success, None on failure/expiry.
    Ticket is deleted immediately after use (one-time).
    """
    _purge_expired()
    entry = _store.pop(ticket, None)
    if entry is None:
        return None
    customer_id, email, expires_at = entry
    if time.monotonic() > expires_at:
        return None
    return {"customer_id": customer_id, "email": email}


def _purge_expired():
    now = time.monotonic()
    expired = [k for k, (_, _, exp) in _store.items() if now > exp]
    for k in expired:
        _store.pop(k, None)
