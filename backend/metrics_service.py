"""
Prometheus metrics for ArtinAzma Expert Assistant.

Exported metrics
────────────────
artin_chat_requests_total           Counter  — total /chat calls handled
artin_chat_requests_by_intent_total Counter  — per-intent breakdown
artin_ai_response_duration_seconds  Histogram — time spent waiting for OpenAI
artin_cache_hits_total              Counter  — response-cache hits
artin_cache_misses_total            Counter  — response-cache misses
artin_knowledge_chunks_total        Gauge    — number of knowledge chunks in store
"""

from prometheus_client import Counter, Histogram, Gauge, REGISTRY
import logging

logger = logging.getLogger(__name__)

# ── Business counters ─────────────────────────────────────────────────────────

chat_requests_total = Counter(
    "artin_chat_requests_total",
    "Total chat requests processed",
)

chat_requests_by_intent = Counter(
    "artin_chat_requests_by_intent_total",
    "Chat requests broken down by detected intent",
    labelnames=["intent"],
)

cache_hits = Counter(
    "artin_cache_hits_total",
    "Response cache hits",
)

cache_misses = Counter(
    "artin_cache_misses_total",
    "Response cache misses (new AI call required)",
)

# ── Latency histograms ────────────────────────────────────────────────────────

ai_response_duration = Histogram(
    "artin_ai_response_duration_seconds",
    "Time waiting for OpenAI response (seconds)",
    buckets=[0.5, 1.0, 2.0, 3.0, 5.0, 8.0, 13.0, 21.0, 34.0],
)

# ── Gauges (refreshed periodically) ──────────────────────────────────────────

knowledge_chunks_gauge = Gauge(
    "artin_knowledge_chunks_total",
    "Number of knowledge chunks currently in the vector store",
)


def refresh_knowledge_gauge() -> None:
    """Update the knowledge-chunks gauge from the live store. Call on startup + after uploads."""
    try:
        from knowledge_service import get_knowledge_stats
        stats = get_knowledge_stats()
        chunks = stats.get("total_chunks", 0) or stats.get("chunk_count", 0)
        knowledge_chunks_gauge.set(chunks)
    except Exception as exc:
        logger.debug("refresh_knowledge_gauge: %s", exc)
