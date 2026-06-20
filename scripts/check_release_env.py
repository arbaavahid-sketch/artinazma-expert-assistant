#!/usr/bin/env python3
"""Validate release environment files without printing secret values."""

from __future__ import annotations

from dataclasses import dataclass
import argparse
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class EnvRule:
    file_key: str
    name: str
    required: bool = True
    min_length: int = 1
    forbid_values: tuple[str, ...] = ()
    pattern: str | None = None
    note: str = ""


ENV_FILES = {
    "root": ROOT / ".env",
    "backend": ROOT / "backend" / ".env",
    "frontend": ROOT / "frontend" / ".env.local",
}

PLACEHOLDER_PREFIXES = (
    "change-me",
    "CHANGE_THIS",
    "your-",
    "your_",
    "sk-your",
    "admin@example.com",
    "yourdomain.com",
)

RULES = [
    # docker-compose root env
    EnvRule("root", "POSTGRES_PASSWORD", min_length=24),
    EnvRule("root", "DOMAIN", forbid_values=("localhost", "127.0.0.1", "yourdomain.com"), pattern=r"^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$"),
    EnvRule("root", "CERTBOT_EMAIL", pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"),
    EnvRule("root", "GRAFANA_PASSWORD", min_length=16),
    # backend env
    EnvRule("backend", "OPENAI_API_KEY", min_length=20, pattern=r"^(sk-|sk-proj-)"),
    EnvRule("backend", "ADMIN_API_KEY", min_length=32),
    EnvRule("backend", "JWT_SECRET", min_length=32),
    EnvRule("backend", "CSRF_SECRET", min_length=32),
    EnvRule("backend", "FRONTEND_ORIGINS", forbid_values=("http://localhost:3000,http://127.0.0.1:3000",)),
    EnvRule("backend", "ENVIRONMENT", forbid_values=("development",), pattern=r"^production$"),
    EnvRule("backend", "COOKIE_SECURE", pattern=r"^(true|1|yes)$"),
    EnvRule("backend", "SENTRY_DSN", required=False, note="recommended for production error tracking"),
    EnvRule("backend", "TELEGRAM_BOT_TOKEN", required=False, note="recommended if request notifications should go to Telegram"),
    EnvRule("backend", "TELEGRAM_CHAT_ID", required=False, note="recommended if Telegram is enabled"),
    EnvRule("backend", "QDRANT_URL", required=False, note="optional; set when using Qdrant instead of JSON vectors"),
    EnvRule("backend", "VAPID_PRIVATE_KEY", required=False, note="optional; required for push notifications"),
    EnvRule("backend", "VAPID_CLAIMS_EMAIL", required=False, pattern=r"^([^@\s]+@[^@\s]+\.[^@\s]+)?$", note="optional; required for push notifications"),
    # frontend env
    EnvRule("frontend", "ADMIN_API_KEY", min_length=32),
    EnvRule("frontend", "ADMIN_PASSWORD", min_length=16),
    EnvRule("frontend", "ADMIN_SESSION_TOKEN", min_length=32),
    EnvRule("frontend", "CUSTOMER_SESSION_SECRET", min_length=32),
    EnvRule("frontend", "NEXT_PUBLIC_API_BASE_URL", forbid_values=("http://127.0.0.1:8000", "http://localhost:8000")),
    EnvRule("frontend", "NEXT_PUBLIC_WS_BASE_URL", forbid_values=("ws://127.0.0.1:8000", "ws://localhost:8000")),
    EnvRule("frontend", "NEXT_PUBLIC_VAPID_PUBLIC_KEY", required=False, note="optional; required for push notifications"),
]

LOCAL_RULES = [
    # Root .env is only needed for local Docker compose. Standalone local dev can
    # run with backend/.env and frontend/.env.local only.
    EnvRule("root", "POSTGRES_PASSWORD", required=False, min_length=12, note="only required for local Docker compose"),
    EnvRule("root", "DOMAIN", required=False, note="only required for local Docker compose"),
    EnvRule("root", "CERTBOT_EMAIL", required=False, note="only required for local Docker compose"),
    EnvRule("root", "GRAFANA_PASSWORD", required=False, min_length=8, note="only required for local Docker compose"),
    # backend local env
    EnvRule("backend", "OPENAI_API_KEY", required=False, min_length=1, note="required only for real AI calls; tests can use offline mode"),
    EnvRule("backend", "ADMIN_API_KEY", min_length=8),
    EnvRule("backend", "JWT_SECRET", min_length=16),
    EnvRule("backend", "CSRF_SECRET", required=False, min_length=16, note="recommended locally; auto-generated if missing"),
    EnvRule("backend", "FRONTEND_ORIGINS", required=False, note="defaults to localhost origins if missing"),
    EnvRule("backend", "ENVIRONMENT", required=False, note="can be development/local for local dev"),
    EnvRule("backend", "COOKIE_SECURE", required=False, pattern=r"^(|false|0|no|true|1|yes)$"),
    EnvRule("backend", "QDRANT_URL", required=False, note="optional locally"),
    # frontend local env
    EnvRule("frontend", "ADMIN_API_KEY", min_length=8),
    EnvRule("frontend", "ADMIN_PASSWORD", min_length=8),
    EnvRule("frontend", "ADMIN_SESSION_TOKEN", min_length=16),
    EnvRule("frontend", "CUSTOMER_SESSION_SECRET", min_length=16),
    EnvRule("frontend", "NEXT_PUBLIC_API_BASE_URL", required=False, note="defaults to local backend if missing"),
    EnvRule("frontend", "NEXT_PUBLIC_WS_BASE_URL", required=False, note="defaults to local backend if missing"),
]


def parse_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        values[key] = value
    return values


def is_placeholder(value: str) -> bool:
    normalized = value.strip()
    return (
        not normalized
        or normalized.startswith("<")
        or any(normalized.startswith(prefix) for prefix in PLACEHOLDER_PREFIXES)
        or "CHANGE_THIS" in normalized
    )


def validate_rule(rule: EnvRule, envs: dict[str, dict[str, str]]) -> tuple[str, str]:
    path = ENV_FILES[rule.file_key]
    if not path.exists():
        return (
            "fail" if rule.required else "warn",
            f"{rule.name} cannot be checked because {path.relative_to(ROOT)} is missing",
        )

    value = envs[rule.file_key].get(rule.name, "")
    if not value:
        return ("fail" if rule.required else "warn", f"{rule.name} is not set")

    if is_placeholder(value):
        return ("fail" if rule.required else "warn", f"{rule.name} still looks like a placeholder")

    if value in rule.forbid_values:
        return ("fail" if rule.required else "warn", f"{rule.name} uses a non-production value")

    if len(value) < rule.min_length:
        return ("fail" if rule.required else "warn", f"{rule.name} is shorter than {rule.min_length} chars")

    if rule.pattern and not re.search(rule.pattern, value, flags=re.IGNORECASE):
        return ("fail" if rule.required else "warn", f"{rule.name} does not match the expected production format")

    return ("pass", f"{rule.name} is set")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mode",
        choices=("local", "production"),
        default="production",
        help="Validation profile to run. Defaults to production.",
    )
    args = parser.parse_args()
    rules = LOCAL_RULES if args.mode == "local" else RULES

    envs = {key: parse_env(path) for key, path in ENV_FILES.items()}
    failures: list[str] = []
    warnings: list[str] = []

    print(f"Environment check ({args.mode})")
    print("===============================")

    for key, path in ENV_FILES.items():
        print(f"{path.relative_to(ROOT)}: {'present' if path.exists() else 'missing'}")
    print()

    for rule in rules:
        status, message = validate_rule(rule, envs)
        label = {"pass": "OK", "warn": "WARN", "fail": "FAIL"}[status]
        suffix = f" ({rule.note})" if rule.note and status != "pass" else ""
        print(f"[{label}] {rule.file_key}.{message}{suffix}")
        if status == "fail":
            failures.append(f"{rule.file_key}.{message}")
        elif status == "warn":
            warnings.append(f"{rule.file_key}.{message}")

    print()
    print(f"Summary: {len(failures)} failure(s), {len(warnings)} warning(s)")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
