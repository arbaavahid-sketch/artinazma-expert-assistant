import os
import re
import shutil
import logging
from pathlib import Path
from datetime import datetime, timezone

from fastapi import APIRouter, Request, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from typing import Optional

from schemas.models import GoogleDriveSyncRequest, KnowledgeSearchRequest, ChunkUpdateRequest
from utils.deps import limiter, require_admin
from utils.chat_utils import make_safe_filename

from knowledge_service import (
    add_file_to_knowledge_base,
    search_knowledge_base,
    get_knowledge_stats,
    delete_knowledge_file,
    reindex_knowledge_file,
)
from local_search_service import local_search_knowledge_base
from google_drive_service import sync_google_drive_folder
from db_service import log_knowledge_action, get_knowledge_audit_log, clear_knowledge_audit_log
from artinazma_index_service import rebuild_artinazma_index, load_index

logger = logging.getLogger("artin_scheduler")

router = APIRouter()

BACKUP_DIR = Path("storage/backups")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
BACKUP_FILE_RE = re.compile(r"^app_backup_\d{8}_\d{6}\.db$")


def _resolve_backup_path(file_name: str) -> Path:
    safe_name = Path(file_name).name
    if safe_name != file_name or not BACKUP_FILE_RE.fullmatch(safe_name):
        raise HTTPException(status_code=404, detail="فایل پیدا نشد.")

    backup_root = BACKUP_DIR.resolve()
    backup_path = (BACKUP_DIR / safe_name).resolve()
    if backup_path.parent != backup_root:
        raise HTTPException(status_code=404, detail="فایل پیدا نشد.")
    return backup_path


@router.post("/knowledge/upload", tags=["Knowledge"], summary="Upload knowledge file")
@limiter.limit("10/minute")
async def upload_knowledge_file(
    request: Request,
    file: UploadFile = File(...),
    title: Optional[str] = Form(None),
    category: Optional[str] = Form("general"),
    replace_existing: bool = Form(False),
    _=Depends(require_admin)
):
    upload_dir = "knowledge_files"
    os.makedirs(upload_dir, exist_ok=True)

    safe_filename = make_safe_filename(file.filename)
    file_path = os.path.join(upload_dir, safe_filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = add_file_to_knowledge_base(
        file_path=file_path,
        title=title or safe_filename,
        category=category or "general",
        replace_existing=replace_existing,
    )

    if result.get("success"):
        log_knowledge_action(
            action="upload",
            file_name=result.get("file_name", safe_filename),
            title=title or safe_filename,
            category=category or "general",
            detail=f"{result.get('chunks_added', 0)} chunk اضافه شد" + (" (جایگزین)" if replace_existing else ""),
        )

    return result


@router.post("/knowledge/sync-google-drive", tags=["Knowledge"], summary="Sync from Google Drive")
def knowledge_sync_google_drive(request: GoogleDriveSyncRequest, _=Depends(require_admin)):
    folder_id = (
        request.root_folder_id.strip()
        or os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()
    )

    if not folder_id:
        return {
            "success": False,
            "message": "GOOGLE_DRIVE_ROOT_FOLDER_ID تنظیم نشده است.",
        }

    try:
        result = sync_google_drive_folder(
            root_folder_id=folder_id,
            max_files=request.max_files,
            force_resync=request.force_resync,
        )
        if result.get("success"):
            log_knowledge_action(
                action="drive_sync",
                detail=(
                    f"پردازش‌شده: {result.get('processed_files', 0)}, "
                    f"اضافه‌شده: {result.get('added_files', 0)}, "
                    f"chunk: {result.get('chunks_added', 0)}"
                    + (" (force resync)" if request.force_resync else "")
                ),
            )
        return result
    except Exception as e:
        return {
            "success": False,
            "message": f"خطا در همگام‌سازی Google Drive: {str(e)}",
        }


@router.get("/knowledge/stats", tags=["Knowledge"], summary="Knowledge base statistics")
def knowledge_stats():
    return get_knowledge_stats()


@router.post("/knowledge/search", tags=["Knowledge"], summary="Search knowledge base")
def knowledge_search(request: KnowledgeSearchRequest):
    query = request.message
    top_k = max(1, min(request.top_k or 10, 30))

    has_astm_code = bool(re.search(r"\bD\s*\d{3,5}\b", query, flags=re.IGNORECASE))

    if has_astm_code:
        local_results = local_search_knowledge_base(query, top_k=top_k)
        if local_results:
            results = local_results
        else:
            results = search_knowledge_base(query, top_k=top_k)
    else:
        try:
            results = search_knowledge_base(query, top_k=top_k)
        except Exception:
            results = local_search_knowledge_base(query, top_k=top_k)

    if request.category and request.category != "all":
        results = [
            item for item in results
            if item.get("category") == request.category
        ]

    return {
        "query": query,
        "total": len(results),
        "results": [
            {
                "title": item["title"],
                "file_name": item["file_name"],
                "category": item["category"],
                "score": float(item.get("score", 0)),
                "score_breakdown": item.get("score_breakdown", {}),
                "score_reason": item.get("score_reason", ""),
                "content": item["content"][:900],
            }
            for item in results
        ],
    }


@router.get("/knowledge/files/{file_name}/chunks")
def knowledge_file_chunks(file_name: str, _=Depends(require_admin)):
    """پیش‌نمایش بخش‌های (chunks) یک فایل دانش."""
    from knowledge_service import load_vector_store
    store = load_vector_store()
    chunks = [
        {
            "index": i,
            "title": item.get("title", ""),
            "category": item.get("category", ""),
            "content": item.get("content", "")[:600],
        }
        for i, item in enumerate(store)
        if item.get("file_name") == file_name
    ]
    return {"file_name": file_name, "total": len(chunks), "chunks": chunks}


@router.patch("/knowledge/files/{file_name}/chunks")
def update_knowledge_chunk(file_name: str, body: ChunkUpdateRequest, _=Depends(require_admin)):
    """ویرایش محتوای یک chunk از بانک دانش."""
    from knowledge_service import load_vector_store, save_vector_store
    store = load_vector_store()

    idx = body.chunk_index
    if idx < 0 or idx >= len(store):
        raise HTTPException(status_code=404, detail="chunk not found")
    if store[idx].get("file_name") != file_name:
        raise HTTPException(status_code=400, detail="chunk does not belong to this file")

    store[idx]["content"] = body.content
    if body.title is not None:
        store[idx]["title"] = body.title

    save_vector_store(store)
    import knowledge_service as _ks
    _ks._vector_cache = None
    _ks._vector_cache_mtime = 0.0

    log_knowledge_action(
        action="chunk_edit",
        file_name=file_name,
        title=store[idx].get("title", ""),
        category=store[idx].get("category", ""),
        detail=f"chunk #{idx} ویرایش شد",
    )

    return {"success": True, "index": idx}


@router.delete("/knowledge/files/{file_name}")
def knowledge_file_delete(file_name: str, _=Depends(require_admin)):
    result = delete_knowledge_file(file_name)
    if result.get("success"):
        log_knowledge_action(
            action="delete",
            file_name=file_name,
            detail=f"{result.get('removed_chunks', 0)} chunk حذف شد",
        )
    return result


@router.post("/knowledge/files/{file_name}/reindex")
def knowledge_file_reindex(file_name: str, _=Depends(require_admin)):
    result = reindex_knowledge_file(file_name)
    if result.get("success"):
        log_knowledge_action(
            action="reindex",
            file_name=result.get("file_name", file_name),
            title=result.get("title", ""),
            category=result.get("category", ""),
            detail=(
                f"{result.get('chunks_added', 0)} chunk بازسازی شد"
                + (
                    f"؛ {result.get('removed_old_chunks', 0)} chunk قبلی حذف شد"
                    if result.get("removed_old_chunks", 0)
                    else ""
                )
            ),
        )
    return result


@router.get("/knowledge/audit-log")
def knowledge_audit_log(limit: int = 100, action: str = "", _=Depends(require_admin)):
    entries = get_knowledge_audit_log(limit=limit, action_filter=action)
    return {"total": len(entries), "entries": entries}


@router.delete("/knowledge/audit-log")
def knowledge_audit_log_clear(_=Depends(require_admin)):
    deleted = clear_knowledge_audit_log()
    return {"success": True, "deleted": deleted}


@router.get("/admin/qdrant-status")
def qdrant_status(_=Depends(require_admin)):
    """وضعیت اتصال به Qdrant و آمار collection."""
    import qdrant_service as _qs
    if not _qs.is_enabled():
        return {
            "enabled": False,
            "message": "Qdrant فعال نیست. متغیر محیطی QDRANT_URL را تنظیم کنید.",
            "backend": "json",
        }
    try:
        stats = _qs.collection_stats()
        return {"enabled": True, "backend": "qdrant", **stats}
    except Exception as e:
        return {"enabled": True, "backend": "qdrant", "error": str(e), "ok": False}


@router.post("/admin/backup/create")
def create_backup(_=Depends(require_admin)):
    """یک نسخه پشتیبان از دیتابیس SQLite ایجاد می‌کند."""
    import sqlite3 as _sqlite3
    from db_service import DB_PATH

    timestamp = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y%m%d_%H%M%S")
    backup_name = f"app_backup_{timestamp}.db"
    backup_path = BACKUP_DIR / backup_name

    try:
        src = _sqlite3.connect(DB_PATH)
        dst = _sqlite3.connect(backup_path)
        src.backup(dst)
        src.close()
        dst.close()
        size_kb = round(backup_path.stat().st_size / 1024, 1)
        return {"success": True, "file_name": backup_name, "size_kb": size_kb}
    except Exception as e:
        logger.error("Backup failed: %s", e)
        return {"success": False, "message": str(e)}


@router.get("/admin/backup/list")
def list_backups(_=Depends(require_admin)):
    """فهرست فایل‌های پشتیبان موجود را برمی‌گرداند."""
    backups = []
    for f in sorted(BACKUP_DIR.glob("app_backup_*.db"), reverse=True):
        if not BACKUP_FILE_RE.fullmatch(f.name):
            continue
        backups.append({
            "file_name": f.name,
            "size_kb": round(f.stat().st_size / 1024, 1),
            "created_at": datetime.utcfromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S"),
        })
    return {"backups": backups}


@router.get("/admin/backup/download/{file_name}")
def download_backup(file_name: str, _=Depends(require_admin)):
    """دانلود یک فایل پشتیبان مشخص."""
    backup_path = _resolve_backup_path(file_name)
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="فایل پیدا نشد.")
    return FileResponse(
        path=backup_path,
        filename=backup_path.name,
        media_type="application/octet-stream",
    )


@router.delete("/admin/backup/{file_name}")
def delete_backup(file_name: str, _=Depends(require_admin)):
    """حذف یک فایل پشتیبان."""
    backup_path = _resolve_backup_path(file_name)
    if not backup_path.exists():
        raise HTTPException(status_code=404, detail="فایل پیدا نشد.")
    backup_path.unlink()
    return {"success": True}


@router.get("/admin/knowledge/export-csv")
def export_knowledge_csv(_=Depends(require_admin)):
    """خروجی CSV از فایل‌های بانک دانش برای دانلود Excel."""
    import csv
    import io
    stats = get_knowledge_stats()
    file_details = stats.get("file_details") or []
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["نام فایل", "عنوان", "دسته‌بندی", "تعداد Chunk"])
    for item in file_details:
        writer.writerow([
            item.get("file_name", ""),
            item.get("title", ""),
            item.get("category", ""),
            item.get("chunks", 0),
        ])
    csv_bytes = output.getvalue().encode("utf-8-sig")
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=knowledge_base.csv"},
    )


@router.post("/knowledge/index-artinazma-site")
def index_artinazma_site(force: bool = False):
    return rebuild_artinazma_index(force=force)


@router.get("/knowledge/artinazma-site-index")
def artinazma_site_index_status():
    index_data = load_index()
    return {
        "count": len(index_data.get("items", [])),
        "created_at": index_data.get("created_at", 0),
        "base_url": index_data.get("base_url", ""),
    }
