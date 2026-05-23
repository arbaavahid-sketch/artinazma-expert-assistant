import os
import json
import math
import time
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional

import numpy as np
from dotenv import load_dotenv
from openai import OpenAI
from pypdf import PdfReader

load_dotenv()

logger = logging.getLogger(__name__)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

EMBEDDING_MODEL = os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")

STORAGE_DIR = Path("storage")
VECTOR_STORE_PATH = STORAGE_DIR / "knowledge_vectors.json"

STORAGE_DIR.mkdir(exist_ok=True)

# ── In-memory cache for knowledge vectors ──────────────────────
# Instead of reading the 394 MB JSON file on every request,
# we keep a single cached copy and only reload when the file changes.
_vector_cache: Optional[List[Dict[str, Any]]] = None
_vector_cache_mtime: float = 0.0


def read_text_from_file(file_path: str) -> str:
    path = Path(file_path)
    ext = path.suffix.lower()

    if ext == ".pdf":
        reader = PdfReader(file_path)
        text = ""

        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"

        return text

    if ext in [".txt", ".md"]:
        return path.read_text(encoding="utf-8", errors="ignore")

    return ""


def chunk_text(text: str, chunk_size: int = 1200, overlap: int = 200) -> List[str]:
    text = " ".join(text.split())

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]

        if len(chunk.strip()) > 100:
            chunks.append(chunk.strip())

        start += chunk_size - overlap

    return chunks


def create_embedding(text: str) -> List[float]:
    response = client.embeddings.create(model=EMBEDDING_MODEL, input=text)

    return response.data[0].embedding


def load_vector_store() -> List[Dict[str, Any]]:
    """Load the vector store with in-memory caching.

    The JSON file is only re-read when its mtime changes, which avoids
    parsing ~394 MB of JSON on every single API call.
    """
    global _vector_cache, _vector_cache_mtime

    if not VECTOR_STORE_PATH.exists():
        _vector_cache = []
        _vector_cache_mtime = 0.0
        return []

    try:
        current_mtime = VECTOR_STORE_PATH.stat().st_mtime
    except OSError:
        current_mtime = 0.0

    if _vector_cache is not None and current_mtime == _vector_cache_mtime:
        return _vector_cache

    logger.info("Reloading knowledge vectors from disk (%.1f MB)...",
                VECTOR_STORE_PATH.stat().st_size / 1_048_576)
    start = time.time()

    with open(VECTOR_STORE_PATH, "r", encoding="utf-8") as f:
        _vector_cache = json.load(f)

    _vector_cache_mtime = current_mtime
    logger.info("Knowledge vectors loaded in %.2fs (%d chunks)",
                time.time() - start, len(_vector_cache))

    return _vector_cache


def invalidate_vector_cache() -> None:
    """Force a reload on next access (call after writes)."""
    global _vector_cache, _vector_cache_mtime
    _vector_cache = None
    _vector_cache_mtime = 0.0


def save_vector_store(data: List[Dict[str, Any]]) -> None:
    temp_path = VECTOR_STORE_PATH.with_suffix(".json.tmp")
    backup_path = VECTOR_STORE_PATH.with_suffix(".json.bak")

    if VECTOR_STORE_PATH.exists():
        try:
            backup_path.write_text(
                VECTOR_STORE_PATH.read_text(encoding="utf-8", errors="ignore"),
                encoding="utf-8",
            )
        except Exception:
            pass

    with open(temp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    os.replace(temp_path, VECTOR_STORE_PATH)

    # Invalidate the in-memory cache so the next read picks up changes
    invalidate_vector_cache()


def knowledge_file_exists(file_name: str) -> bool:
    store = load_vector_store()

    return any(item.get("file_name") == file_name for item in store)


def delete_knowledge_file(file_name: str) -> Dict[str, Any]:
    store = load_vector_store()

    before_count = len(store)

    new_store = [item for item in store if item.get("file_name") != file_name]

    removed_chunks = before_count - len(new_store)

    if removed_chunks == 0:
        return {
            "success": False,
            "message": "فایلی با این نام در بانک دانش پیدا نشد.",
            "file_name": file_name,
            "removed_chunks": 0,
        }

    save_vector_store(new_store)

    return {
        "success": True,
        "message": "فایل با موفقیت از بانک دانش حذف شد.",
        "file_name": file_name,
        "removed_chunks": removed_chunks,
    }


def replace_knowledge_file_if_exists(file_name: str) -> int:
    store = load_vector_store()

    before_count = len(store)

    new_store = [item for item in store if item.get("file_name") != file_name]

    removed_chunks = before_count - len(new_store)

    if removed_chunks > 0:
        save_vector_store(new_store)

    return removed_chunks


def cosine_similarity(a: List[float], b: List[float]) -> float:
    vector_a = np.array(a)
    vector_b = np.array(b)

    denominator = np.linalg.norm(vector_a) * np.linalg.norm(vector_b)

    if denominator == 0:
        return 0.0

    return float(np.dot(vector_a, vector_b) / denominator)


def add_file_to_knowledge_base(
    file_path: str,
    title: str = "",
    category: str = "general",
    replace_existing: bool = False,
) -> Dict[str, Any]:
    file_name = Path(file_path).name

    if knowledge_file_exists(file_name):
        if not replace_existing:
            return {
                "success": False,
                "duplicate": True,
                "message": "این فایل قبلاً در بانک دانش ثبت شده است. اگر می‌خواهید نسخه قبلی حذف و فایل جدید جایگزین شود، گزینه جایگزینی فایل تکراری را فعال کنید.",
                "file_name": file_name,
            }

        removed_chunks = replace_knowledge_file_if_exists(file_name)
    else:
        removed_chunks = 0

    text = read_text_from_file(file_path)

    if not text.strip():
        return {
            "success": False,
            "message": "متنی از فایل استخراج نشد. فعلاً PDF متنی، TXT و MD پشتیبانی می‌شوند.",
        }

    chunks = chunk_text(text)

    store = load_vector_store()

    added_chunks = 0

    for index, chunk in enumerate(chunks):
        embedding = create_embedding(chunk)

        store.append(
            {
                "title": title or file_name,
                "category": category,
                "file_name": file_name,
                "chunk_index": index,
                "content": chunk,
                "embedding": embedding,
            }
        )

        added_chunks += 1

    save_vector_store(store)

    return {
        "success": True,
        "message": "فایل با موفقیت به بانک دانش اضافه شد.",
        "file_name": file_name,
        "chunks_added": added_chunks,
        "replaced": replace_existing,
        "removed_old_chunks": removed_chunks,
    }


def search_knowledge_base(query: str, top_k: int = 5) -> List[Dict[str, Any]]:
    store = load_vector_store()

    if not store:
        return []

    query_embedding = create_embedding(query)

    # ── Vectorised cosine similarity (much faster than per-item loop) ──
    query_vec = np.array(query_embedding, dtype=np.float32)
    embeddings = np.array(
        [item["embedding"] for item in store], dtype=np.float32
    )
    # dot products and norms in one shot
    dots = embeddings @ query_vec
    norms = np.linalg.norm(embeddings, axis=1) * np.linalg.norm(query_vec)
    norms[norms == 0] = 1.0  # avoid division by zero
    scores = dots / norms

    # Get top-k indices without full sort (O(n) vs O(n log n))
    if len(scores) > top_k:
        top_indices = np.argpartition(scores, -top_k)[-top_k:]
        top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]
    else:
        top_indices = np.argsort(scores)[::-1]

    results = []
    for idx in top_indices:
        item = store[idx]
        results.append(
            {
                "score": float(scores[idx]),
                "title": item["title"],
                "category": item["category"],
                "file_name": item["file_name"],
                "chunk_index": item["chunk_index"],
                "content": item["content"],
            }
        )

    return results


def get_knowledge_stats() -> Dict[str, Any]:
    store = load_vector_store()

    files = sorted(list(set(item["file_name"] for item in store)))
    categories = sorted(list(set(item["category"] for item in store)))

    file_map = {}

    for item in store:
        file_name = item.get("file_name", "unknown")

        if file_name not in file_map:
            file_map[file_name] = {
                "file_name": file_name,
                "title": item.get("title", file_name),
                "category": item.get("category", "general"),
                "categories": set(),
                "chunks": 0,
            }

        file_map[file_name]["chunks"] += 1
        file_map[file_name]["categories"].add(item.get("category", "general"))

        if item.get("title"):
            file_map[file_name]["title"] = item.get("title")

    file_details = []

    for file_name, data in file_map.items():
        file_details.append(
            {
                "file_name": data["file_name"],
                "title": data["title"],
                "category": data["category"],
                "categories": sorted(list(data["categories"])),
                "chunks": data["chunks"],
            }
        )

    file_details.sort(key=lambda item: item["file_name"])

    return {
        "total_chunks": len(store),
        "total_files": len(files),
        "files": files,
        "categories": categories,
        "file_details": file_details,
    }


def add_text_to_knowledge_base(
    title: str,
    content: str,
    category: str = "expert-faq",
    file_name: str = "expert_faq.txt",
) -> Dict[str, Any]:
    if not content.strip():
        return {
            "success": False,
            "message": "متنی برای افزودن به بانک دانش وجود ندارد.",
        }

    chunks = chunk_text(content)

    store = load_vector_store()

    added_chunks = 0

    for index, chunk in enumerate(chunks):
        embedding = create_embedding(chunk)

        store.append(
            {
                "title": title,
                "category": category,
                "file_name": file_name,
                "chunk_index": index,
                "content": chunk,
                "embedding": embedding,
            }
        )

        added_chunks += 1

    save_vector_store(store)

    return {
        "success": True,
        "message": "متن با موفقیت به بانک دانش اضافه شد.",
        "title": title,
        "file_name": file_name,
        "category": category,
        "chunks_added": added_chunks,
    }
