import os
import re
import json
import time
import logging
import shutil
import sys
import tempfile
import threading
from contextlib import contextmanager
from pathlib import Path
from typing import List, Dict, Any, Optional

# fcntl is Unix-only. On Windows we fall back to msvcrt for advisory file
# locking so the backend can still run cross-platform.
if sys.platform == "win32":
    import msvcrt  # type: ignore[import-not-found]
    fcntl = None  # type: ignore[assignment]
else:
    import fcntl  # type: ignore[import-not-found]
    msvcrt = None  # type: ignore[assignment]

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

# Prevent concurrent read-modify-write operations inside one process.
_vector_store_lock = threading.RLock()


@contextmanager
def _vector_store_write_lock():
    """Serialize vector-store writers across threads and processes."""
    lock_path = VECTOR_STORE_PATH.with_name(
        f".{VECTOR_STORE_PATH.name}.lock"
    )
    lock_path.parent.mkdir(parents=True, exist_ok=True)

    with _vector_store_lock:
        with lock_path.open("a+", encoding="utf-8") as lock_file:
            if sys.platform == "win32":
                # msvcrt.locking locks bytes starting at the current file
                # offset. Seek to 0 and lock a single byte as a coarse advisory.
                try:
                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
                    acquired = True
                except OSError:
                    # Fall back to the in-process lock only if the OS lock
                    # can't be acquired (e.g., file is on a network share).
                    acquired = False
                try:
                    yield
                finally:
                    if acquired:
                        try:
                            lock_file.seek(0)
                            msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
                        except OSError:
                            pass
            else:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)


_TATWEEL = "ـ"  # کشیده‌ی چاپی «ـ» که استخراج PDF فارسی وسط کلمات می‌گذارد


def normalize_persian_text(text: str) -> str:
    """
    متنِ استخراج‌شده از PDFهای فارسی را برای embedding/جست‌وجو تمیز می‌کند.

    استخراج PDF فارسیِ چاپی معمولاً کیفیت بدی دارد: «کشیده» وسط کلمات
    (گیــری)، چسبیدنِ لاتین به فارسی (SEدستگاه) و حروف عربی. این تابع آن‌ها را
    اصلاح می‌کند تا نامِ مدل و کلمات، تمیز و قابل‌بازیابی شوند. روی متنِ انگلیسی
    بی‌اثر و امن است.
    """
    if not text:
        return ""
    text = text.replace(_TATWEEL, "")
    text = text.replace("ي", "ی").replace("ك", "ک")  # عربی → فارسی
    # فاصله بین لاتین/عدد و فارسی (SEدستگاه → SE دستگاه)
    text = re.sub(r"([A-Za-z0-9])([؀-ۿ])", r"\1 \2", text)
    text = re.sub(r"([؀-ۿ])([A-Za-z0-9])", r"\1 \2", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text


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

        return normalize_persian_text(text)

    if ext in [".txt", ".md"]:
        return normalize_persian_text(path.read_text(encoding="utf-8", errors="ignore"))

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


def create_embedding(text: str) -> Optional[List[float]]:
    """
    بردار embedding متن را می‌سازد. اگر سرویس embedding در دسترس نباشد
    (مثلاً درگاهی که مدل embedding ندارد)، به‌جای خطا None برمی‌گرداند تا
    جریان چت متوقف نشود و به جستجوی محلی برگردد.
    """
    try:
        response = client.embeddings.create(model=EMBEDDING_MODEL, input=text)
        return response.data[0].embedding
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Embedding unavailable (model=%s): %s — skipping vector search.",
            EMBEDDING_MODEL, exc,
        )
        return None


def load_vector_store() -> List[Dict[str, Any]]:
    """Load the vector store with safe in-memory caching."""
    global _vector_cache, _vector_cache_mtime

    with _vector_store_lock:
        if not VECTOR_STORE_PATH.exists():
            _vector_cache = []
            _vector_cache_mtime = 0.0
            return []

        try:
            current_mtime = VECTOR_STORE_PATH.stat().st_mtime
        except OSError:
            current_mtime = 0.0

        if (
            _vector_cache is not None
            and current_mtime == _vector_cache_mtime
        ):
            return _vector_cache

        logger.info(
            "Reloading knowledge vectors from disk (%.1f MB)...",
            VECTOR_STORE_PATH.stat().st_size / 1_048_576,
        )
        started_at = time.time()

        try:
            with VECTOR_STORE_PATH.open(
                "r",
                encoding="utf-8",
            ) as file:
                loaded = json.load(file)
        except json.JSONDecodeError:
            backup_path = VECTOR_STORE_PATH.with_suffix(
                ".json.bak"
            )

            logger.exception(
                "Main knowledge vector JSON is corrupted."
            )

            if not backup_path.exists():
                raise

            logger.warning(
                "Recovering knowledge vectors from %s",
                backup_path,
            )

            with backup_path.open(
                "r",
                encoding="utf-8",
            ) as file:
                loaded = json.load(file)

            _save_vector_store_unlocked(
                loaded,
                create_backup=False,
            )

            current_mtime = VECTOR_STORE_PATH.stat().st_mtime

        if not isinstance(loaded, list):
            raise ValueError(
                "Knowledge vector store must contain a JSON array."
            )

        _vector_cache = loaded
        _vector_cache_mtime = current_mtime

        logger.info(
            "Knowledge vectors loaded in %.2fs (%d chunks)",
            time.time() - started_at,
            len(_vector_cache),
        )

        return _vector_cache


def invalidate_vector_cache() -> None:
    """Force a reload on the next access."""
    global _vector_cache, _vector_cache_mtime

    with _vector_store_lock:
        _vector_cache = None
        _vector_cache_mtime = 0.0


def _save_vector_store_unlocked(
    data: List[Dict[str, Any]],
    *,
    create_backup: bool = True,
) -> None:
    """Atomically save data. Caller must hold the write lock."""
    STORAGE_DIR.mkdir(parents=True, exist_ok=True)

    backup_path = VECTOR_STORE_PATH.with_suffix(
        ".json.bak"
    )

    if create_backup and VECTOR_STORE_PATH.exists():
        try:
            shutil.copy2(
                VECTOR_STORE_PATH,
                backup_path,
            )
        except Exception:
            logger.exception(
                "Could not create vector-store backup."
            )

    fd, temp_name = tempfile.mkstemp(
        prefix=f".{VECTOR_STORE_PATH.name}.",
        suffix=".tmp",
        dir=str(VECTOR_STORE_PATH.parent),
    )

    temp_path = Path(temp_name)

    try:
        with os.fdopen(
            fd,
            "w",
            encoding="utf-8",
        ) as file:
            json.dump(
                data,
                file,
                ensure_ascii=False,
                indent=2,
            )
            file.flush()
            os.fsync(file.fileno())

        os.replace(
            temp_path,
            VECTOR_STORE_PATH,
        )

        try:
            directory_fd = os.open(
                str(VECTOR_STORE_PATH.parent),
                os.O_DIRECTORY,
            )
            try:
                os.fsync(directory_fd)
            finally:
                os.close(directory_fd)
        except OSError:
            pass
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)

    invalidate_vector_cache()


def save_vector_store(data: List[Dict[str, Any]]) -> None:
    """Safely and atomically replace the local vector store."""
    with _vector_store_write_lock():
        _save_vector_store_unlocked(
            list(data),
        )


def knowledge_file_exists(file_name: str) -> bool:
    store = load_vector_store()

    return any(item.get("file_name") == file_name for item in store)


def delete_knowledge_file(file_name: str) -> Dict[str, Any]:
    import qdrant_service as _qs

    with _vector_store_write_lock():
        store = load_vector_store()
        new_store = [
            item
            for item in store
            if item.get("file_name") != file_name
        ]
        removed_chunks = len(store) - len(new_store)

        exists_in_qdrant = (
            _qs.is_enabled()
            and _qs.file_exists(file_name)
        )

        if removed_chunks == 0 and not exists_in_qdrant:
            return {
                "success": False,
                "message": (
                    "فایلی با این نام در بانک دانش پیدا نشد."
                ),
                "file_name": file_name,
                "removed_chunks": 0,
            }

        if _qs.is_enabled():
            _qs.delete_by_file(file_name)

        if removed_chunks > 0:
            _save_vector_store_unlocked(new_store)

        return {
            "success": True,
            "message": (
                "فایل با موفقیت از بانک دانش حذف شد."
            ),
            "file_name": file_name,
            "removed_chunks": removed_chunks,
        }


def reindex_knowledge_file(file_name: str) -> Dict[str, Any]:
    safe_name = Path(file_name).name
    source_path = Path("knowledge_files") / safe_name

    if safe_name != file_name or not source_path.exists():
        return {
            "success": False,
            "message": "فایل منبع برای بازسازی پیدا نشد.",
            "file_name": file_name,
            "reason": "source_missing",
        }

    store = load_vector_store()
    existing_chunks = [
        item for item in store if item.get("file_name") == safe_name
    ]
    title = safe_name
    category = "general"

    if existing_chunks:
        first_chunk = existing_chunks[0]
        title = first_chunk.get("title") or safe_name
        category_counts: Dict[str, int] = {}
        for item in existing_chunks:
            cat = item.get("category") or "general"
            category_counts[cat] = category_counts.get(cat, 0) + 1
        category = max(category_counts.items(), key=lambda item: item[1])[0]

    result = add_file_to_knowledge_base(
        file_path=str(source_path),
        title=title,
        category=category,
        replace_existing=True,
    )
    result["reindexed"] = bool(result.get("success"))
    result["source_file"] = str(source_path)
    return result


def replace_knowledge_file_if_exists(
    file_name: str,
) -> int:
    with _vector_store_write_lock():
        store = load_vector_store()
        new_store = [
            item
            for item in store
            if item.get("file_name") != file_name
        ]

        removed_chunks = len(store) - len(new_store)

        if removed_chunks > 0:
            _save_vector_store_unlocked(new_store)

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
    import qdrant_service as _qs

    file_name = Path(file_path).name

    # Fast duplicate check before performing expensive embeddings.
    if (
        not replace_existing
        and knowledge_file_exists(file_name)
    ):
        return {
            "success": False,
            "duplicate": True,
            "message": (
                "این فایل قبلاً در بانک دانش ثبت شده است. "
                "اگر می‌خواهید نسخه قبلی حذف و فایل جدید "
                "جایگزین شود، گزینه جایگزینی فایل تکراری "
                "را فعال کنید."
            ),
            "file_name": file_name,
        }

    text = read_text_from_file(file_path)

    if not text.strip():
        return {
            "success": False,
            "message": (
                "متنی از فایل استخراج نشد. فعلاً PDF متنی، "
                "TXT و MD پشتیبانی می‌شوند."
            ),
        }

    chunks = chunk_text(text)
    effective_title = title or file_name
    chunk_dicts = []

    for index, chunk in enumerate(chunks):
        embedding = create_embedding(chunk)

        if embedding is None:
            continue

        chunk_dicts.append({
            "title": effective_title,
            "category": category,
            "file_name": file_name,
            "chunk_index": index,
            "content": chunk,
            "embedding": embedding,
        })

    if not chunk_dicts:
        return {
            "success": False,
            "message": (
                "هیچ بردار قابل‌استفاده‌ای برای فایل ساخته نشد."
            ),
            "file_name": file_name,
        }

    with _vector_store_write_lock():
        # Reload while holding the transaction lock, because another
        # upload may have completed while embeddings were generated.
        store = load_vector_store()

        existing_chunks = [
            item
            for item in store
            if item.get("file_name") == file_name
        ]

        if existing_chunks and not replace_existing:
            return {
                "success": False,
                "duplicate": True,
                "message": (
                    "این فایل قبلاً در بانک دانش ثبت شده است."
                ),
                "file_name": file_name,
            }

        new_store = [
            item
            for item in store
            if item.get("file_name") != file_name
        ]

        removed_chunks = len(store) - len(new_store)

        if _qs.is_enabled():
            # Always remove previous Qdrant chunks first. This also
            # removes stale chunks when the new file is shorter.
            _qs.delete_by_file(file_name)
            _qs.upsert_chunks(chunk_dicts)

        new_store.extend(chunk_dicts)
        _save_vector_store_unlocked(new_store)

    return {
        "success": True,
        "message": (
            "فایل با موفقیت به بانک دانش اضافه شد."
        ),
        "file_name": file_name,
        "chunks_added": len(chunk_dicts),
        "replaced": replace_existing,
        "removed_old_chunks": removed_chunks,
        "backend": (
            "qdrant"
            if _qs.is_enabled()
            else "json"
        ),
    }


def search_knowledge_base(
    query: str,
    top_k: int = 5,
    category_filter: Optional[str] = None,
) -> List[Dict[str, Any]]:
    import qdrant_service as _qs

    query_embedding = create_embedding(query)

    # اگر embedding در دسترس نبود، جستجوی برداری را رد کن (جستجوی محلی پابرجاست).
    if query_embedding is None:
        return []

    if _qs.is_enabled():
        try:
            return _qs.hybrid_search(query, query_embedding, top_k=top_k, category_filter=category_filter)
        except Exception as e:
            logger.warning("Qdrant search failed, falling back to JSON: %s", e)

    # ── JSON / numpy fallback ──────────────────────────────────────────────
    store = load_vector_store()

    if not store:
        return []

    if category_filter:
        store = [item for item in store if item.get("category") == category_filter]
        if not store:
            return []

    # Vectorised cosine similarity (much faster than per-item loop)
    query_vec = np.array(query_embedding, dtype=np.float32)
    embeddings = np.array(
        [item["embedding"] for item in store], dtype=np.float32
    )
    dots = embeddings @ query_vec
    norms = np.linalg.norm(embeddings, axis=1) * np.linalg.norm(query_vec)
    norms[norms == 0] = 1.0
    scores = dots / norms

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
                "score": round(float(scores[idx]) * 100, 2),  # 0-100 scale
                "score_breakdown": {
                    "algorithm": "json_vector",
                    "vector_score": round(float(scores[idx]), 4),
                    "category_filter": category_filter or "",
                },
                "score_reason": "vector similarity",
                "title": item["title"],
                "category": item["category"],
                "file_name": item["file_name"],
                "chunk_index": item["chunk_index"],
                "content": item["content"],
            }
        )

    return results


def get_knowledge_stats() -> Dict[str, Any]:
    import qdrant_service as _qs
    backend = "qdrant" if _qs.is_enabled() else "json"
    qdrant_status: Dict[str, Any] = {}

    if _qs.is_enabled():
        try:
            store = _qs.all_payloads()
            qdrant_status = _qs.collection_stats()
        except Exception as exc:
            logger.warning("Qdrant stats failed, falling back to JSON: %s", exc)
            store = load_vector_store()
            backend = "json_fallback"
            qdrant_status = {"error": str(exc)}
    else:
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
                "embedded_chunks": 0,
                "missing_embedding_chunks": 0,
            }

        file_map[file_name]["chunks"] += 1
        file_map[file_name]["categories"].add(item.get("category", "general"))
        embedding = item.get("embedding")
        if _qs.is_enabled() and backend == "qdrant":
            file_map[file_name]["embedded_chunks"] += 1
        elif isinstance(embedding, list) and len(embedding) > 0:
            file_map[file_name]["embedded_chunks"] += 1
        else:
            file_map[file_name]["missing_embedding_chunks"] += 1

        if item.get("title"):
            file_map[file_name]["title"] = item.get("title")

    file_details = []

    for file_name, data in file_map.items():
        source_path = Path("knowledge_files") / file_name
        source_exists = source_path.exists()
        source_updated_at = ""
        source_size_kb = 0.0
        if source_exists:
            try:
                stat = source_path.stat()
                source_size_kb = round(stat.st_size / 1024, 1)
                source_updated_at = time.strftime(
                    "%Y-%m-%dT%H:%M:%S",
                    time.localtime(stat.st_mtime),
                )
            except OSError:
                source_exists = False

        if data["chunks"] == 0:
            embedding_status = "missing"
        elif data["missing_embedding_chunks"] == 0:
            embedding_status = "embedded"
        elif data["embedded_chunks"] == 0:
            embedding_status = "missing"
        else:
            embedding_status = "partial"

        file_details.append(
            {
                "file_name": data["file_name"],
                "title": data["title"],
                "category": data["category"],
                "categories": sorted(list(data["categories"])),
                "chunks": data["chunks"],
                "embedding_status": embedding_status,
                "embedded_chunks": data["embedded_chunks"],
                "missing_embedding_chunks": data["missing_embedding_chunks"],
                "source_exists": source_exists,
                "source_size_kb": source_size_kb,
                "source_updated_at": source_updated_at,
            }
        )

    file_details.sort(key=lambda item: item["file_name"])

    # Category breakdown: count chunks per category
    cat_counts: Dict[str, int] = {}
    for item in store:
        cat = item.get("category") or "general"
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    total = len(store) or 1
    category_breakdown = [
        {"category": cat, "chunks": cnt, "percent": round(cnt / total * 100, 1)}
        for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1])
    ]

    vector_store_updated_at = ""
    vector_store_size_mb = 0.0
    if VECTOR_STORE_PATH.exists():
        try:
            stat = VECTOR_STORE_PATH.stat()
            vector_store_size_mb = round(stat.st_size / 1_048_576, 2)
            vector_store_updated_at = time.strftime(
                "%Y-%m-%dT%H:%M:%S",
                time.localtime(stat.st_mtime),
            )
        except OSError:
            pass

    last_sync = ""
    last_sync_result = ""
    try:
        from db_service import get_setting

        last_sync = get_setting("gdrive_last_sync", "")
        last_sync_result = get_setting("gdrive_last_sync_result", "")
    except Exception:
        pass

    return {
        "total_chunks": len(store),
        "total_files": len(files),
        "files": files,
        "categories": categories,
        "file_details": file_details,
        "category_breakdown": category_breakdown,
        "backend": backend,
        "embedding_model": EMBEDDING_MODEL,
        "vector_store_path": str(VECTOR_STORE_PATH),
        "vector_store_exists": VECTOR_STORE_PATH.exists(),
        "vector_store_size_mb": vector_store_size_mb,
        "vector_store_updated_at": vector_store_updated_at,
        "last_sync": last_sync,
        "last_sync_result": last_sync_result,
        "qdrant": qdrant_status,
    }


def add_text_to_knowledge_base(
    title: str,
    content: str,
    category: str = "expert-faq",
    file_name: str = "expert_faq.txt",
) -> Dict[str, Any]:
    import qdrant_service as _qs

    if not content.strip():
        return {
            "success": False,
            "message": "متنی برای افزودن به بانک دانش وجود ندارد.",
        }

    chunks = chunk_text(content)
    chunk_dicts = []

    for index, chunk in enumerate(chunks):
        embedding = create_embedding(chunk)

        if embedding is None:
            continue

        chunk_dicts.append({
            "title": title,
            "category": category,
            "file_name": file_name,
            "chunk_index": index,
            "content": chunk,
            "embedding": embedding,
        })

    if not chunk_dicts:
        return {
            "success": False,
            "message": "هیچ بردار قابل‌استفاده‌ای برای متن ساخته نشد.",
            "file_name": file_name,
        }

    with _vector_store_write_lock():
        store = load_vector_store()
        new_store = [
            item
            for item in store
            if item.get("file_name") != file_name
        ]
        removed_chunks = len(store) - len(new_store)

        if _qs.is_enabled():
            _qs.delete_by_file(file_name)
            _qs.upsert_chunks(chunk_dicts)

        new_store.extend(chunk_dicts)
        _save_vector_store_unlocked(new_store)

    return {
        "success": True,
        "message": "متن با موفقیت به بانک دانش اضافه شد.",
        "title": title,
        "file_name": file_name,
        "category": category,
        "chunks_added": len(chunk_dicts),
        "replaced": removed_chunks > 0,
        "removed_old_chunks": removed_chunks,
        "backend": "qdrant" if _qs.is_enabled() else "json",
    }
