from datetime import datetime, timezone
from repositories.base import get_connection


def get_setting(key: str, default: str = "") -> str:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM app_settings WHERE key = ?", (key,)
        ).fetchone()
        return row["value"] if row else default
    finally:
        conn.close()


def set_setting(key: str, value: str) -> None:
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO app_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
            """,
            (key, value, datetime.now(timezone.utc).replace(tzinfo=None).isoformat()),
        )
        conn.commit()
    finally:
        conn.close()
