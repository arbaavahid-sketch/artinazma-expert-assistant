"""
Database connection adapter -- supports both SQLite (dev) and PostgreSQL (prod).

Set DATABASE_URL env var to switch backends:
  SQLite    (default): not set
  PostgreSQL (prod):   postgresql://user:pass@host:5432/dbname

PostgreSQL connections are managed via a ThreadedConnectionPool (psycopg2).
Pool size is configurable via DB_POOL_MIN / DB_POOL_MAX env vars (default 2/10).

The returned connection mirrors the sqlite3 API:
  conn.execute(sql, params)  -> _DBCursor  (.fetchall / .fetchone / .lastrowid)
  conn.cursor()              -> _DBCursor
  conn.commit() / conn.close()
  with get_connection() as conn: ...    (auto-commit on success, rollback on exc)
"""

import os
import sqlite3
import threading
from pathlib import Path
from typing import Optional, Sequence

# -- Configuration ------------------------------------------------------------

DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()

STORAGE_DIR = Path("storage")
DB_PATH = STORAGE_DIR / "app.db"
STORAGE_DIR.mkdir(exist_ok=True)

_BACKEND: str = "sqlite"
if DATABASE_URL and (
    DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")
):
    _BACKEND = "postgres"


# -- Common exception ---------------------------------------------------------


class DBIntegrityError(Exception):
    """Unique-constraint or integrity violation (both backends)."""


# -- Row wrapper (PostgreSQL) -------------------------------------------------


class _PGRow(dict):
    """Dict-like row supporting both r['col'] and r[0] integer access."""

    def __getitem__(self, key):
        if isinstance(key, int):
            return list(self.values())[key]
        return super().__getitem__(key)


# -- Cursor wrapper -----------------------------------------------------------


class _DBCursor:
    """Unified cursor over sqlite3 or psycopg2 raw cursors."""

    def __init__(self, raw, backend: str, connection: "_DBConnection"):
        self._raw = raw
        self._backend = backend
        self._conn_ref = connection
        self.lastrowid: Optional[int] = None
        self.rowcount: int = 0

    def execute(self, sql: str, params: Sequence = ()):
        if self._backend == "postgres":
            self._execute_pg(sql, params)
        else:
            self._execute_sqlite(sql, params)
        return self

    def _execute_sqlite(self, sql: str, params):
        import sqlite3 as _sqlite3
        try:
            self._raw.execute(sql, params)
        except _sqlite3.IntegrityError as exc:
            raise DBIntegrityError(str(exc)) from exc
        self.lastrowid = self._raw.lastrowid
        self.rowcount = self._raw.rowcount
        self._conn_ref._last_rowcount = self.rowcount

    def _execute_pg(self, sql: str, params):
        pg_sql = sql.replace("?", "%s")
        stripped = pg_sql.strip().upper()

        # Shim: SELECT changes() -> return cached rowcount
        if stripped == "SELECT CHANGES()":
            self._fake_changes = self._conn_ref._last_rowcount
            return

        is_insert = stripped.startswith("INSERT")
        if is_insert and "RETURNING" not in stripped:
            pg_sql = pg_sql.rstrip().rstrip(";") + " RETURNING id"

        try:
            self._raw.execute(pg_sql, params if params else None)
        except Exception as exc:
            exc_type = type(exc).__name__
            exc_mod = type(exc).__module__
            if (
                "IntegrityError" in exc_type
                or "UniqueViolation" in exc_type
                or "psycopg2.errors" in exc_mod
            ):
                raise DBIntegrityError(str(exc)) from exc
            raise

        if is_insert:
            row = self._raw.fetchone()
            self.lastrowid = row[0] if row else None
        self.rowcount = self._raw.rowcount
        self._conn_ref._last_rowcount = self.rowcount

    def fetchall(self):
        if self._backend == "postgres":
            if not self._raw.description:
                return []
            cols = [d[0] for d in self._raw.description]
            return [_PGRow(zip(cols, row)) for row in self._raw.fetchall()]
        return self._raw.fetchall()

    def fetchone(self):
        if self._backend == "postgres" and hasattr(self, "_fake_changes"):
            return _PGRow({"changes()": self._fake_changes})
        if self._backend == "postgres":
            row = self._raw.fetchone()
            if row is None:
                return None
            if not self._raw.description:
                return None
            cols = [d[0] for d in self._raw.description]
            return _PGRow(zip(cols, row))
        return self._raw.fetchone()

    def __iter__(self):
        return iter(self.fetchall())


# -- Connection wrapper -------------------------------------------------------


class _DBConnection:
    def __init__(self, raw, backend: str, pool=None):
        self._raw = raw
        self._backend = backend
        self._last_rowcount: int = 0
        self._pool = pool  # psycopg2 pool to return connection to on close

    def cursor(self) -> _DBCursor:
        return _DBCursor(self._raw.cursor(), self._backend, self)

    def execute(self, sql: str, params: Sequence = ()) -> _DBCursor:
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._raw.commit()

    def rollback(self):
        self._raw.rollback()

    def close(self):
        if self._pool is not None:
            try:
                self._raw.rollback()
            except Exception:
                pass
            # Return connection to the pool instead of closing it
            self._pool.putconn(self._raw)
        else:
            self._raw.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None:
            self.commit()
        else:
            try:
                self.rollback()
            except Exception:
                pass
        self.close()
        return False


# -- PostgreSQL connection pool (lazy-initialised, thread-safe) ---------------

_pool_instance = None
_pool_lock = threading.Lock()


def _pg_pool():
    """Return the shared ThreadedConnectionPool, creating it on first call."""
    global _pool_instance
    if _pool_instance is None:
        with _pool_lock:
            if _pool_instance is None:
                import psycopg2.pool  # type: ignore[import]
                minconn = int(os.getenv("DB_POOL_MIN", "2"))
                maxconn = int(os.getenv("DB_POOL_MAX", "10"))
                _pool_instance = psycopg2.pool.ThreadedConnectionPool(
                    minconn, maxconn, DATABASE_URL
                )
    return _pool_instance


# -- Factory ------------------------------------------------------------------


def get_connection() -> _DBConnection:
    if _BACKEND == "postgres":
        return _get_pg_connection()
    return _get_sqlite_connection()


def _get_sqlite_connection() -> _DBConnection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return _DBConnection(conn, "sqlite")


def _get_pg_connection() -> _DBConnection:
    pool = _pg_pool()
    conn = pool.getconn()
    return _DBConnection(conn, "postgres", pool=pool)


__all__ = ["get_connection", "DBIntegrityError", "STORAGE_DIR", "DB_PATH", "_BACKEND"]
