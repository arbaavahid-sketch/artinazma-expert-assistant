"""
Qdrant vector database backend for ArtinAzma knowledge base.

Activated automatically when QDRANT_URL env var is set.
Falls back to the JSON-file store when Qdrant is not configured.

Environment variables:
  QDRANT_URL        Qdrant server URL, e.g. http://localhost:6333
  QDRANT_API_KEY    (optional) API key for Qdrant Cloud
  QDRANT_COLLECTION Collection name (default: artinazma_knowledge)
  QDRANT_VECTOR_SIZE Embedding dimension (default: 1536 for text-embedding-3-small)
"""

import hashlib
import logging
import os
from typing import Any, Dict, List, Optional

logger = logging.getLogger("artin_qdrant")

QDRANT_URL = os.getenv("QDRANT_URL", "").strip()
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "").strip() or None
COLLECTION = os.getenv("QDRANT_COLLECTION", "artinazma_knowledge")
VECTOR_SIZE = int(os.getenv("QDRANT_VECTOR_SIZE", "1536"))

_client = None  # lazy-initialised


def is_enabled() -> bool:
    """Return True when Qdrant is configured."""
    return bool(QDRANT_URL)


def _get_client():
    global _client
    if _client is None:
        from qdrant_client import QdrantClient
        kwargs: Dict[str, Any] = {"url": QDRANT_URL, "timeout": 30}
        if QDRANT_API_KEY:
            kwargs["api_key"] = QDRANT_API_KEY
        _client = QdrantClient(**kwargs)
        _ensure_collection(_client)
    return _client


def _ensure_collection(client) -> None:
    """Create the collection if it doesn't exist yet, then ensure payload indexes."""
    from qdrant_client.models import VectorParams, Distance, PayloadSchemaType

    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION not in existing:
        client.create_collection(
            collection_name=COLLECTION,
            vectors_config=VectorParams(size=VECTOR_SIZE, distance=Distance.COSINE),
        )
        logger.info("Created Qdrant collection '%s'", COLLECTION)

    # Ensure keyword indexes exist (required for filtered count/delete/search).
    # create_payload_index is idempotent — safe to call on every startup.
    for field in ("file_name", "category"):
        try:
            client.create_payload_index(
                collection_name=COLLECTION,
                field_name=field,
                field_schema=PayloadSchemaType.KEYWORD,
            )
        except Exception as exc:
            # Ignore "already exists" or similar; log anything unexpected.
            logger.debug("create_payload_index(%s): %s", field, exc)

    # Ensure full-text index on 'content' for hybrid search
    ensure_fulltext_index()


def _chunk_id(file_name: str, chunk_index: int) -> int:
    """Deterministic integer ID from file_name + chunk_index."""
    key = f"{file_name}::{chunk_index}"
    return int(hashlib.sha256(key.encode()).hexdigest()[:16], 16)


# ─── Write operations ──────────────────────────────────────────────────────────

def upsert_chunks(chunks: List[Dict[str, Any]]) -> int:
    """
    Insert or update a list of chunk dicts.
    Each dict must have: file_name, chunk_index, embedding, title, category, content.
    Returns the number of points upserted.
    """
    from qdrant_client.models import PointStruct

    client = _get_client()
    points = []
    for chunk in chunks:
        point_id = _chunk_id(chunk["file_name"], chunk["chunk_index"])
        payload = {
            "title": chunk.get("title", ""),
            "category": chunk.get("category", "general"),
            "file_name": chunk["file_name"],
            "chunk_index": chunk["chunk_index"],
            "content": chunk.get("content", ""),
        }
        points.append(
            PointStruct(id=point_id, vector=chunk["embedding"], payload=payload)
        )

    batch_size = 100
    for i in range(0, len(points), batch_size):
        client.upsert(
            collection_name=COLLECTION,
            points=points[i : i + batch_size],
        )

    logger.info("Upserted %d chunks to Qdrant", len(points))
    return len(points)


def delete_by_file(file_name: str) -> int:
    """Delete all vectors for a given file. Returns number deleted."""
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    client = _get_client()

    # First count how many we're about to delete
    count_result = client.count(
        collection_name=COLLECTION,
        count_filter=Filter(
            must=[FieldCondition(key="file_name", match=MatchValue(value=file_name))]
        ),
        exact=True,
    )
    count = count_result.count

    if count > 0:
        client.delete(
            collection_name=COLLECTION,
            points_selector=Filter(
                must=[
                    FieldCondition(key="file_name", match=MatchValue(value=file_name))
                ]
            ),
        )
        logger.info("Deleted %d Qdrant points for file '%s'", count, file_name)

    return count


# ─── Read / Search operations ──────────────────────────────────────────────────

def search(
    query_embedding: List[float],
    top_k: int = 5,
    category_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Vector similarity search. Returns up to top_k results sorted by score desc.
    Optionally filter by category payload field.
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    client = _get_client()

    search_filter = None
    if category_filter:
        search_filter = Filter(
            must=[
                FieldCondition(
                    key="category", match=MatchValue(value=category_filter)
                )
            ]
        )

    hits = client.query_points(
        collection_name=COLLECTION,
        query=query_embedding,
        limit=top_k,
        query_filter=search_filter,
        with_payload=True,
    ).points

    results = []
    for hit in hits:
        p = hit.payload or {}
        results.append(
            {
                "title": p.get("title", ""),
                "category": p.get("category", ""),
                "file_name": p.get("file_name", ""),
                "chunk_index": p.get("chunk_index", 0),
                "content": p.get("content", ""),
                "score": round(hit.score * 100, 2),  # 0-100 scale like JSON store
            }
        )

    return results


def file_exists(file_name: str) -> bool:
    """Check if any chunk for this file exists in Qdrant."""
    from qdrant_client.models import Filter, FieldCondition, MatchValue

    client = _get_client()
    result = client.count(
        collection_name=COLLECTION,
        count_filter=Filter(
            must=[FieldCondition(key="file_name", match=MatchValue(value=file_name))]
        ),
        exact=False,
    )
    return result.count > 0


def list_files() -> List[str]:
    """Return a deduplicated list of all file_name values in the collection."""
    client = _get_client()
    # Scroll through all points to collect unique file names
    file_names: set = set()
    offset = None

    while True:
        records, next_offset = client.scroll(
            collection_name=COLLECTION,
            scroll_filter=None,
            limit=1000,
            offset=offset,
            with_payload=["file_name"],
            with_vectors=False,
        )
        for record in records:
            fn = (record.payload or {}).get("file_name", "")
            if fn:
                file_names.add(fn)

        if next_offset is None:
            break
        offset = next_offset

    return sorted(file_names)


def all_payloads() -> List[Dict[str, Any]]:
    """Scroll the whole collection and return one dict per chunk with its
    metadata (file_name, category, title, chunk_index). Mirrors the shape of
    the legacy JSON vector store so callers can compute stats uniformly."""
    client = _get_client()
    items: List[Dict[str, Any]] = []
    offset = None

    while True:
        records, next_offset = client.scroll(
            collection_name=COLLECTION,
            scroll_filter=None,
            limit=1000,
            offset=offset,
            with_payload=["file_name", "category", "title", "chunk_index"],
            with_vectors=False,
        )
        for record in records:
            p = record.payload or {}
            items.append({
                "file_name": p.get("file_name", "unknown"),
                "category": p.get("category", "general"),
                "title": p.get("title", ""),
                "chunk_index": p.get("chunk_index", 0),
            })
        if next_offset is None:
            break
        offset = next_offset

    return items


def collection_stats() -> Dict[str, Any]:
    """Return basic stats about the Qdrant collection."""
    client = _get_client()
    info = client.get_collection(COLLECTION)
    points_count = getattr(info, "points_count", None) or getattr(info, "vectors_count", None) or 0
    vectors_count = getattr(info, "vectors_count", None) or points_count
    return {
        "vectors_count": vectors_count,
        "points_count": points_count,
        "collection": COLLECTION,
        "status": str(info.status),
    }


# ─── Hybrid search (vector + full-text keyword) ───────────────────────────────

def ensure_fulltext_index() -> None:
    """Create a full-text payload index on 'content' for keyword search."""
    from qdrant_client.models import TextIndexParams, TokenizerType
    client = _get_client()
    try:
        client.create_payload_index(
            collection_name=COLLECTION,
            field_name="content",
            field_schema=TextIndexParams(
                type="text",
                tokenizer=TokenizerType.WORD,
                min_token_len=2,
                max_token_len=20,
                lowercase=True,
            ),
        )
        logger.info("Full-text index on 'content' ensured")
    except Exception as exc:
        logger.debug("ensure_fulltext_index: %s", exc)


def hybrid_search(
    query: str,
    query_embedding: List[float],
    top_k: int = 5,
    category_filter: Optional[str] = None,
    vector_weight: float = 0.7,
) -> List[Dict[str, Any]]:
    """
    Hybrid search: combines vector similarity + full-text keyword search.
    Results are merged with Reciprocal Rank Fusion (RRF).

    Args:
        query:           Raw query text (used for keyword matching)
        query_embedding: Dense embedding of the query
        top_k:           Number of results to return
        category_filter: Optional category payload filter
        vector_weight:   Weight for vector scores vs keyword scores (0-1)
    """
    from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchText

    client = _get_client()
    fetch_k = top_k * 3   # fetch more candidates for re-ranking

    base_filter = None
    if category_filter:
        base_filter = Filter(
            must=[FieldCondition(key="category", match=MatchValue(value=category_filter))]
        )

    # ── 1. Vector search ──────────────────────────────────────────────────────
    vector_hits = client.query_points(
        collection_name=COLLECTION,
        query=query_embedding,
        limit=fetch_k,
        query_filter=base_filter,
        with_payload=True,
    ).points

    # ── 2. Full-text keyword search ───────────────────────────────────────────
    # Build OR filter for significant query tokens
    tokens = [t.strip() for t in query.split() if len(t.strip()) >= 2][:8]
    keyword_hits = []
    if tokens:
        try:
            keyword_filter_conditions = [
                FieldCondition(key="content", match=MatchText(text=tok))
                for tok in tokens
            ]
            kw_filter = Filter(
                should=keyword_filter_conditions,
                minimum_should_match=1,
            )
            if base_filter:
                kw_filter = Filter(must=[base_filter, kw_filter])

            keyword_hits = client.query_points(
                collection_name=COLLECTION,
                query=query_embedding,      # still need a vector for Qdrant search
                limit=fetch_k,
                query_filter=kw_filter,
                with_payload=True,
            ).points
        except Exception as exc:
            logger.debug("keyword search failed (index may not exist yet): %s", exc)

    # ── 3. Reciprocal Rank Fusion ─────────────────────────────────────────────
    # RRF score = 1/(k + rank), k=60 is a common default
    RRF_K = 60
    scores: dict[int, float] = {}
    payloads: dict[int, Any] = {}

    for rank, hit in enumerate(vector_hits):
        scores[hit.id] = scores.get(hit.id, 0.0) + vector_weight / (RRF_K + rank + 1)
        payloads[hit.id] = hit.payload

    kw_weight = 1.0 - vector_weight
    for rank, hit in enumerate(keyword_hits):
        scores[hit.id] = scores.get(hit.id, 0.0) + kw_weight / (RRF_K + rank + 1)
        if hit.id not in payloads:
            payloads[hit.id] = hit.payload

    # Sort by combined RRF score
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

    results = []
    max_rrf = ranked[0][1] if ranked else 1.0
    for point_id, rrf_score in ranked:
        p = payloads.get(point_id) or {}
        results.append({
            "title":       p.get("title", ""),
            "category":    p.get("category", ""),
            "file_name":   p.get("file_name", ""),
            "chunk_index": p.get("chunk_index", 0),
            "content":     p.get("content", ""),
            "score":       round((rrf_score / max_rrf) * 100, 2),
        })

    return results
