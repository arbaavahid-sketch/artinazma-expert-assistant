import sqlite3
from pathlib import Path

STORAGE_DIR = Path("storage")
DB_PATH = STORAGE_DIR / "app.db"


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
