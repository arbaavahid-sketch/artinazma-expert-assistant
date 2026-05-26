"""
پاکسازی فایل‌های قدیمی آپلود — اجرای دوره‌ای با cron یا دستی.
فایل‌های بالای MAX_AGE_HOURS ساعت از پوشه uploads حذف می‌شوند.
"""

import os
import time
import argparse

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
DEFAULT_MAX_AGE_HOURS = 24


def cleanup(max_age_hours: int = DEFAULT_MAX_AGE_HOURS, dry_run: bool = False):
    if not os.path.isdir(UPLOAD_DIR):
        print(f"[cleanup] Upload directory not found: {UPLOAD_DIR}")
        return

    now = time.time()
    cutoff = now - (max_age_hours * 3600)
    removed = 0

    for fname in os.listdir(UPLOAD_DIR):
        fpath = os.path.join(UPLOAD_DIR, fname)
        if not os.path.isfile(fpath):
            continue
        if os.path.getmtime(fpath) < cutoff:
            if dry_run:
                print(f"  [dry-run] Would remove: {fname}")
            else:
                os.remove(fpath)
                print(f"  Removed: {fname}")
            removed += 1

    print(f"[cleanup] {'Would remove' if dry_run else 'Removed'} {removed} file(s) older than {max_age_hours}h")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Clean up old uploaded files")
    parser.add_argument("--hours", type=int, default=DEFAULT_MAX_AGE_HOURS, help="Max age in hours (default: 24)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without deleting")
    args = parser.parse_args()
    cleanup(max_age_hours=args.hours, dry_run=args.dry_run)
