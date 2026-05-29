"""
One-time migration script: copy all vectors from knowledge_vectors.json → Qdrant.

Usage:
    # Make sure QDRANT_URL is set in backend/.env
    cd backend
    python migrate_to_qdrant.py

The script is idempotent — it uses upsert, so running it twice is safe.
The JSON file is NOT deleted; it remains as a local backup / fallback.
"""

import json
import sys
import time
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

import qdrant_service as qs

VECTOR_STORE_PATH = Path("storage/knowledge_vectors.json")


def main():
    if not qs.is_enabled():
        print("❌  QDRANT_URL is not set. Nothing to migrate.")
        sys.exit(1)

    if not VECTOR_STORE_PATH.exists():
        print("❌  storage/knowledge_vectors.json not found. Nothing to migrate.")
        sys.exit(1)

    print(f"📂  Reading {VECTOR_STORE_PATH} …")
    with open(VECTOR_STORE_PATH, "r", encoding="utf-8") as f:
        store = json.load(f)

    total = len(store)
    print(f"📊  Found {total:,} chunks.")

    if total == 0:
        print("Nothing to migrate.")
        return

    # Batch upsert — small batches to avoid cloud timeouts
    batch_size = 40
    max_retries = 3
    start = time.time()
    uploaded = 0

    for i in range(0, total, batch_size):
        batch = store[i : i + batch_size]
        for attempt in range(1, max_retries + 1):
            try:
                qs.upsert_chunks(batch)
                break
            except Exception as e:
                if attempt == max_retries:
                    print(f"\n❌  Failed after {max_retries} attempts at chunk {i}: {e}")
                    raise
                wait = 5 * attempt
                print(f"\n⚠️  Timeout on attempt {attempt}, retrying in {wait}s…")
                time.sleep(wait)
        uploaded += len(batch)
        pct = uploaded / total * 100
        elapsed = time.time() - start
        rate = uploaded / elapsed if elapsed > 0 else 0
        eta = (total - uploaded) / rate if rate > 0 else 0
        print(
            f"  ✓  {uploaded:,}/{total:,}  ({pct:.1f}%)  "
            f"{rate:.0f} chunks/s  ETA {eta:.0f}s",
            end="\r",
            flush=True,
        )

    elapsed = time.time() - start
    print(f"\n✅  Migration complete — {uploaded:,} chunks in {elapsed:.1f}s")

    stats = qs.collection_stats()
    print(f"📈  Qdrant collection '{stats['collection']}': {stats['points_count']:,} points")


if __name__ == "__main__":
    main()
