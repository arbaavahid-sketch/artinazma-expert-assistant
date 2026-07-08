"""Background and single-run manager for Google Drive synchronization."""

import logging
import os
import threading
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from google_drive_service import sync_google_drive_folder
from repositories.settings_repo import get_setting, set_setting


logger = logging.getLogger("artin_scheduler")
_sync_lock = threading.Lock()

# نتیجهٔ کامل آخرین اجرا (شامل ریز نتایج فایل‌ها) برای نمایش در پنل ادمین.
# در حافظهٔ همین پروسه است؛ خلاصهٔ متنی همچنان در settings ذخیره می‌شود.
_last_run_result: Optional[Dict[str, Any]] = None
_last_run_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def is_gdrive_sync_running() -> bool:
    return _sync_lock.locked()


def get_gdrive_sync_status() -> str:
    if is_gdrive_sync_running():
        return "running"

    stored_status = get_setting("gdrive_sync_status", "idle")

    # The previous process may have stopped during a running synchronization.
    if stored_status == "running":
        return "interrupted"

    return stored_status or "idle"


def get_last_run_result() -> Optional[Dict[str, Any]]:
    """نتیجهٔ کامل آخرین سینکِ این پروسه (یا None اگر هنوز اجرایی نبوده)."""
    with _last_run_lock:
        return _last_run_result


def _store_last_run(result: Dict[str, Any]) -> None:
    global _last_run_result
    with _last_run_lock:
        _last_run_result = result


def _format_result(result: Dict[str, Any]) -> str:
    added = int(result.get("added_files") or 0)
    unchanged = int(result.get("unchanged_files") or 0)
    skipped = int(result.get("skipped_files") or 0)
    chunks = int(result.get("chunks_added") or 0)

    return (
        f"{added} فایل افزوده، "
        f"{unchanged} فایل بدون تغییر، "
        f"{skipped} فایل ردشده، "
        f"{chunks} بخش جدید"
    )


def _sync_worker(
    trigger: str,
    folder_id: str,
    max_files: int,
    force_resync: bool,
) -> None:
    try:
        logger.info("Starting %s Google Drive sync", trigger)

        result = sync_google_drive_folder(
            root_folder_id=folder_id,
            max_files=max_files,
            force_resync=force_resync,
        )

        _store_last_run(result)

        if not result.get("success"):
            raise RuntimeError(
                result.get("message") or "Google Drive synchronization failed."
            )

        finished_at = _now_iso()
        result_text = _format_result(result)

        set_setting("gdrive_last_sync", finished_at)
        set_setting("gdrive_last_sync_result", result_text)
        set_setting("gdrive_sync_status", "success")
        set_setting("gdrive_sync_finished_at", finished_at)

        logger.info(
            "%s Google Drive sync completed: %s",
            trigger,
            result_text,
        )
    except Exception as exc:
        finished_at = _now_iso()

        set_setting("gdrive_sync_status", "error")
        set_setting("gdrive_sync_finished_at", finished_at)
        set_setting("gdrive_last_sync_result", f"خطا: {exc}")

        logger.exception("%s Google Drive sync failed", trigger)
    finally:
        _sync_lock.release()


def start_gdrive_sync(
    trigger: str = "manual",
    max_files: int = 200,
    force_resync: bool = False,
) -> Tuple[bool, str]:
    folder_id = os.getenv("GOOGLE_DRIVE_ROOT_FOLDER_ID", "").strip()

    if not folder_id:
        return False, "شناسه پوشه Google Drive تنظیم نشده است."

    if not _sync_lock.acquire(blocking=False):
        return False, "یک همگام‌سازی دیگر هم‌اکنون در حال اجرا است."

    started_at = _now_iso()

    try:
        set_setting("gdrive_sync_status", "running")
        set_setting("gdrive_sync_started_at", started_at)
        set_setting("gdrive_last_sync_result", "در حال همگام‌سازی...")

        worker = threading.Thread(
            target=_sync_worker,
            args=(trigger, folder_id, max_files, force_resync),
            name=f"gdrive-sync-{trigger}",
            daemon=True,
        )
        worker.start()
    except Exception:
        _sync_lock.release()
        raise

    return True, "همگام‌سازی در پس‌زمینه آغاز شد."
