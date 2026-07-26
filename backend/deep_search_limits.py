"""Tiered daily caps + a global daily fuse for the agentic deep-research path.

Deep research (Responses API + gpt-5.4) is ~10-30x the cost of a normal answer,
so we cap it to protect the OpenAI budget WITHOUT hurting real customers:

  - anonymous (per client IP):   DEEP_SEARCH_ANON_DAILY      (default 5/day)
  - logged-in customer (per id): DEEP_SEARCH_CUSTOMER_DAILY  (default 30/day)
  - global circuit-breaker/fuse: DEEP_SEARCH_GLOBAL_DAILY    (default 300/day)

When a cap is hit the request does NOT fail — the caller simply falls back to the
cheaper web path (Tavily context + standard model), so the user still gets a
web-informed answer, just not the premium agentic search.

Counters are in-memory with a daily rollover (single uvicorn worker). They reset
on container restart — fine for cost protection; move to Redis/DB later if durable
counts are needed. usage_snapshot() exposes today's usage for the admin panel.
"""

import os
import logging
import threading
from datetime import date

logger = logging.getLogger("deep_search")

ANON_DAILY = int(os.getenv("DEEP_SEARCH_ANON_DAILY", "5"))
CUSTOMER_DAILY = int(os.getenv("DEEP_SEARCH_CUSTOMER_DAILY", "30"))
GLOBAL_DAILY = int(os.getenv("DEEP_SEARCH_GLOBAL_DAILY", "300"))

_lock = threading.Lock()
_day: str | None = None
_counts: dict[str, int] = {}
_global_used: int = 0


def _rollover_locked() -> None:
    global _day, _counts, _global_used
    today = date.today().isoformat()
    if _day != today:
        _day = today
        _counts = {}
        _global_used = 0


def allow_deep_search(client_ip: str = "", customer_id=None) -> bool:
    """Return True and record one use if within caps; False if any cap is hit.
    Call exactly once per request, only for deep-research-eligible queries."""
    global _global_used
    with _lock:
        _rollover_locked()

        if _global_used >= GLOBAL_DAILY:
            logger.warning("[deep-search] global daily fuse hit (%d/%d) — falling back",
                           _global_used, GLOBAL_DAILY)
            return False

        if customer_id:
            key, cap = f"c:{customer_id}", CUSTOMER_DAILY
        else:
            key, cap = f"ip:{client_ip or 'unknown'}", ANON_DAILY

        used = _counts.get(key, 0)
        if used >= cap:
            logger.info("[deep-search] cap reached for %s (%d/%d) — falling back", key, used, cap)
            return False

        _counts[key] = used + 1
        _global_used += 1
        logger.info("[deep-search] allowed %s (%d/%d) | global %d/%d",
                    key, used + 1, cap, _global_used, GLOBAL_DAILY)
        return True


def usage_snapshot() -> dict:
    """Today's usage, for the admin panel."""
    with _lock:
        _rollover_locked()
        customers = {k[2:]: v for k, v in _counts.items() if k.startswith("c:")}
        ips = {k[3:]: v for k, v in _counts.items() if k.startswith("ip:")}
        return {
            "date": _day,
            "global_used": _global_used,
            "global_cap": GLOBAL_DAILY,
            "caps": {"anonymous": ANON_DAILY, "customer": CUSTOMER_DAILY},
            "by_customer": dict(sorted(customers.items(), key=lambda x: -x[1])),
            "by_ip": dict(sorted(ips.items(), key=lambda x: -x[1])),
            "distinct_users": len(_counts),
        }
