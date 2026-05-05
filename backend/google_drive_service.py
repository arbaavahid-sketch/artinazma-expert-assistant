import io
import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from knowledge_service import add_file_to_knowledge_base


SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

DOWNLOAD_DIR = Path("google_drive_files")
DOWNLOAD_DIR.mkdir(exist_ok=True)

GOOGLE_FOLDER_MIME_TYPE = "application/vnd.google-apps.folder"

SUPPORTED_BINARY_EXTENSIONS = {
    ".pdf",
    ".txt",
    ".md",
}

GOOGLE_EXPORT_TYPES = {
    "application/vnd.google-apps.document": {
        "export_mime": "text/plain",
        "extension": ".txt",
    },
    "application/vnd.google-apps.spreadsheet": {
        "export_mime": "text/csv",
        "extension": ".txt",
    },
    "application/vnd.google-apps.presentation": {
        "export_mime": "text/plain",
        "extension": ".txt",
    },
}

CATEGORY_MAP = {
    "equipment": "equipment",
    "equipments": "equipment",
    "laboratory equipment": "equipment",
    "تجهیزات": "equipment",
    "دستگاه": "equipment",

    "catalyst": "catalyst",
    "catalysts": "catalyst",
    "کاتالیست": "catalyst",

    "chemicals": "general",
    "chemical": "general",
    "مواد شیمیایی": "general",

    "astm": "ASTM Standards",
    "astm standards": "ASTM Standards",
    "استاندارد": "ASTM Standards",
    "استانداردهای astm": "ASTM Standards",

    "chromatography": "chromatography",
    "gc": "chromatography",
    "hplc": "chromatography",
    "کروماتوگرافی": "chromatography",

    "mercury": "mercury-analysis",
    "mercury analysis": "mercury-analysis",
    "جیوه": "mercury-analysis",
    "آنالیز جیوه": "mercury-analysis",

    "sulfur": "sulfur-analysis",
    "sulphur": "sulfur-analysis",
    "sulfur analysis": "sulfur-analysis",
    "سولفور": "sulfur-analysis",
    "گوگرد": "sulfur-analysis",
    "آنالیز سولفور": "sulfur-analysis",

    "troubleshooting": "troubleshooting",
    "عیب یابی": "troubleshooting",
    "عیب‌یابی": "troubleshooting",

    "application notes": "application-note",
    "application note": "application-note",
    "اپلیکیشن نوت": "application-note",
}


def make_safe_filename(filename: str) -> str:
    base_name = os.path.basename(filename or "drive_file")
    safe_name = base_name.replace(" ", "_")
    safe_name = re.sub(r"[^A-Za-z0-9_\-.\u0600-\u06FF]", "_", safe_name)

    if not safe_name or safe_name in [".", ".."]:
        safe_name = "drive_file"

    return safe_name


def normalize_category(folder_name: str) -> str:
    normalized = (folder_name or "").strip().lower()
    normalized = normalized.replace("_", " ").replace("-", " ")

    return CATEGORY_MAP.get(normalized, normalized or "general")


def get_drive_credentials():
    service_account_json = os.getenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON", "").strip()
    service_account_file = os.getenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE", "").strip()

    if service_account_json:
        info = json.loads(service_account_json)
        return service_account.Credentials.from_service_account_info(
            info,
            scopes=SCOPES,
        )

    if service_account_file:
        return service_account.Credentials.from_service_account_file(
            service_account_file,
            scopes=SCOPES,
        )

    raise RuntimeError(
        "Google Drive credentials are not configured. Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON or GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE."
    )


def get_drive_service():
    credentials = get_drive_credentials()
    return build("drive", "v3", credentials=credentials, cache_discovery=False)


def list_folder_items(service, folder_id: str) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    page_token: Optional[str] = None

    while True:
        response = (
            service.files()
            .list(
                q=f"'{folder_id}' in parents and trashed = false",
                spaces="drive",
                fields="nextPageToken, files(id, name, mimeType, modifiedTime)",
                pageToken=page_token,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )

        items.extend(response.get("files", []))
        page_token = response.get("nextPageToken")

        if not page_token:
            break

    return items


def download_binary_file(service, file_id: str, output_path: Path) -> None:
    request = service.files().get_media(fileId=file_id, supportsAllDrives=True)

    with output_path.open("wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False

        while not done:
            _, done = downloader.next_chunk()


def export_google_file(service, file_id: str, export_mime: str, output_path: Path) -> None:
    request = service.files().export_media(fileId=file_id, mimeType=export_mime)

    with output_path.open("wb") as f:
        downloader = MediaIoBaseDownload(f, request)
        done = False

        while not done:
            _, done = downloader.next_chunk()


def prepare_drive_file(service, item: Dict[str, Any]) -> Dict[str, Any]:
    file_id = item["id"]
    original_name = item["name"]
    mime_type = item.get("mimeType", "")

    safe_original_name = make_safe_filename(original_name)
    original_path = Path(safe_original_name)
    original_ext = original_path.suffix.lower()

    if mime_type in GOOGLE_EXPORT_TYPES:
        export_info = GOOGLE_EXPORT_TYPES[mime_type]
        extension = export_info["extension"]
        output_name = f"gdrive_{file_id}_{original_path.stem}{extension}"
        output_path = DOWNLOAD_DIR / make_safe_filename(output_name)

        export_google_file(
            service=service,
            file_id=file_id,
            export_mime=export_info["export_mime"],
            output_path=output_path,
        )

        return {
            "success": True,
            "path": str(output_path),
            "title": original_name,
            "file_name": output_path.name,
            "source_type": "google_export",
        }

    if original_ext in SUPPORTED_BINARY_EXTENSIONS:
        output_name = f"gdrive_{file_id}_{safe_original_name}"
        output_path = DOWNLOAD_DIR / make_safe_filename(output_name)

        download_binary_file(
            service=service,
            file_id=file_id,
            output_path=output_path,
        )

        return {
            "success": True,
            "path": str(output_path),
            "title": original_name,
            "file_name": output_path.name,
            "source_type": "binary",
        }

    return {
        "success": False,
        "reason": "unsupported_file_type",
        "title": original_name,
        "mime_type": mime_type,
    }


def walk_drive_folder(
    service,
    folder_id: str,
    current_category: str = "general",
    is_root: bool = False,
    max_files: int = 200,
    state: Optional[Dict[str, int]] = None,
) -> List[Dict[str, Any]]:
    if state is None:
        state = {"processed_files": 0}

    results: List[Dict[str, Any]] = []
    items = list_folder_items(service, folder_id)

    for item in items:
        if state["processed_files"] >= max_files:
            results.append({
                "success": False,
                "title": item.get("name", ""),
                "reason": "max_files_limit_reached",
            })
            break

        mime_type = item.get("mimeType", "")

        if mime_type == GOOGLE_FOLDER_MIME_TYPE:
            folder_name = item.get("name", "")
            next_category = normalize_category(folder_name) if is_root else current_category

            results.extend(
                walk_drive_folder(
                    service=service,
                    folder_id=item["id"],
                    current_category=next_category,
                    is_root=False,
                    max_files=max_files,
                    state=state,
                )
            )
            continue

        state["processed_files"] += 1

        prepared = prepare_drive_file(service, item)

        if not prepared.get("success"):
            results.append({
                "success": False,
                "title": prepared.get("title", item.get("name", "")),
                "category": current_category,
                "reason": prepared.get("reason", "download_failed"),
                "mime_type": prepared.get("mime_type", mime_type),
            })
            continue

        try:
            add_result = add_file_to_knowledge_base(
                file_path=prepared["path"],
                title=prepared["title"],
                category=current_category,
                replace_existing=True,
            )

            results.append({
                "success": bool(add_result.get("success")),
                "title": prepared["title"],
                "file_name": prepared["file_name"],
                "category": current_category,
                "chunks_added": add_result.get("chunks_added", 0),
                "message": add_result.get("message", ""),
                "source_type": prepared.get("source_type", ""),
            })
        except Exception as e:
            results.append({
                "success": False,
                "title": prepared.get("title", item.get("name", "")),
                "category": current_category,
                "reason": str(e),
            })

    return results


def sync_google_drive_folder(
    root_folder_id: str,
    max_files: int = 200,
) -> Dict[str, Any]:
    if not root_folder_id.strip():
        return {
            "success": False,
            "message": "Google Drive folder ID is empty.",
        }

    service = get_drive_service()

    results = walk_drive_folder(
        service=service,
        folder_id=root_folder_id,
        current_category="general",
        is_root=True,
        max_files=max_files,
    )

    added_files = [item for item in results if item.get("success")]
    skipped_files = [item for item in results if not item.get("success")]

    total_chunks = sum(int(item.get("chunks_added") or 0) for item in added_files)

    return {
        "success": True,
        "message": "Google Drive sync completed.",
        "processed_files": len(results),
        "added_files": len(added_files),
        "skipped_files": len(skipped_files),
        "chunks_added": total_chunks,
        "results": results[:100],
    }