#!/usr/bin/env python3
"""Fail if git-tracked files look like local secrets or runtime backups."""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

SENSITIVE_PATH_RE = re.compile(
    r"("
    r"(^|/)\.env($|\.)|"
    r"service[-_]?account.*\.json$|"
    r"credentials.*\.json$|"
    r"client_secret.*\.json$|"
    r"(^|/)backend/google_drive_files/|"
    r"(^|/)backend/storage/|"
    r"(^|/)storage/|"
    r"\.(pem|key|p12|pfx|sqlite|sqlite3|db|dump|bak|snapshot)$|"
    r"\.sql\.gz$"
    r")",
    re.IGNORECASE,
)

SECRET_CONTENT_RE = re.compile(
    r"("
    r"-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----|"
    r'"type"\s*:\s*"service_account"|'
    r'"private_key"\s*:|'
    r"OPENAI_API_KEY\s*=\s*sk-(?!your-|test-|docker-smoke-placeholder\b)[A-Za-z0-9_-]+|"
    r"ADMIN_API_KEY\s*=\s*(?!process\.env\b|os\.environ\b|change-me|test-|your-|example|docker-smoke-|<)[^\s#]+"
    r")",
    re.IGNORECASE,
)

ALLOW_EXAMPLE_RE = re.compile(r"(^|/)(\.env\.example|\.env\.local\.example)$|\.example$", re.IGNORECASE)
TEXT_SUFFIXES = {
    ".env",
    ".example",
    ".json",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".py",
    ".md",
    ".yml",
    ".yaml",
    ".toml",
    ".ini",
    ".sh",
    ".txt",
}


def git_ls_files() -> list[str]:
    result = subprocess.run(
        ["git", "ls-files"],
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=True,
    )
    return [line.strip().replace("\\", "/") for line in result.stdout.splitlines() if line.strip()]


def is_text_candidate(path: str) -> bool:
    file_path = ROOT / path
    return file_path.suffix.lower() in TEXT_SUFFIXES and file_path.exists() and file_path.stat().st_size < 2_000_000


def main() -> int:
    findings: list[str] = []

    for path in git_ls_files():
        if ALLOW_EXAMPLE_RE.search(path):
            continue
        if SENSITIVE_PATH_RE.search(path):
            findings.append(f"sensitive tracked path: {path}")
            continue
        if is_text_candidate(path):
            try:
                text = (ROOT / path).read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if SECRET_CONTENT_RE.search(text):
                findings.append(f"possible secret content: {path}")

    if findings:
        print("Secret scan failed:")
        for finding in findings:
            print(f"- {finding}")
        return 1

    print("Secret scan passed: no tracked secrets or runtime backups found.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
