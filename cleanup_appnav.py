from pathlib import Path
import shutil

PROJECT_ROOT = Path(__file__).resolve().parent
APP_DIR = PROJECT_ROOT / "frontend" / "src" / "app"
BACKUP_DIR = PROJECT_ROOT / "_backup_before_appnav_cleanup"

TARGET_FILES = list(APP_DIR.rglob("page.tsx"))

REMOVE_LINES_CONTAINING = [
    'import AppNav from "@/components/AppNav";',
    "import AppNav from '@/components/AppNav';",
    "<AppNav />",
]

def clean_file(file_path: Path):
    original = file_path.read_text(encoding="utf-8")
    cleaned_lines = []

    changed = False

    for line in original.splitlines():
        should_remove = any(target in line for target in REMOVE_LINES_CONTAINING)

        if should_remove:
            changed = True
            continue

        cleaned_lines.append(line)

    cleaned = "\n".join(cleaned_lines) + "\n"

    if changed:
        backup_path = BACKUP_DIR / file_path.relative_to(PROJECT_ROOT)
        backup_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file_path, backup_path)

        file_path.write_text(cleaned, encoding="utf-8")
        print(f"Cleaned: {file_path}")

def main():
    BACKUP_DIR.mkdir(exist_ok=True)

    if not TARGET_FILES:
        print("No page.tsx files found.")
        return

    for file_path in TARGET_FILES:
        clean_file(file_path)

    print("\nDone.")
    print(f"Backup saved in: {BACKUP_DIR}")

if __name__ == "__main__":
    main()