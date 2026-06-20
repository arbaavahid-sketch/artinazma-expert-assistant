"""
Structured JSON logging for ArtinAzma backend.

When LOG_FORMAT=json (default in production), every log record is emitted as
a single JSON line — easy to ingest into Grafana Loki, ELK, or any log aggregator.

When LOG_FORMAT=text (default in development), a human-readable format is used.

Usage:
    from logging_config import setup_logging
    setup_logging()           # call once at startup

    import logging
    logger = logging.getLogger("my_module")
    logger.info("message", extra={"user_id": 42})   # extra fields appear in JSON
"""

import json
import logging
import logging.handlers
import os
import sys
from pathlib import Path


class _JSONFormatter(logging.Formatter):
    """Emit each log record as a single-line JSON object."""

    SKIP_ATTRS = frozenset({
        "args", "created", "exc_info", "exc_text", "filename", "funcName",
        "id", "levelno", "lineno", "message", "module", "msecs", "msg",
        "name", "pathname", "process", "processName", "relativeCreated",
        "stack_info", "taskName", "thread", "threadName",
    })

    def format(self, record: logging.LogRecord) -> str:
        record.message = record.getMessage()
        doc: dict = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.message,
        }

        # Add exception info if present
        if record.exc_info:
            doc["exc"] = self.formatException(record.exc_info)

        # Add any extra fields attached via logger.info("...", extra={...})
        for key, val in record.__dict__.items():
            if key not in self.SKIP_ATTRS and not key.startswith("_"):
                try:
                    json.dumps(val)   # only include JSON-serialisable values
                    doc[key] = val
                except (TypeError, ValueError):
                    doc[key] = str(val)

        return json.dumps(doc, ensure_ascii=False)


def setup_logging() -> None:
    """
    Configure root logger.

    Environment variables:
        LOG_LEVEL   — DEBUG / INFO / WARNING / ERROR (default: INFO)
        LOG_FORMAT  — json / text (default: json in production, text in dev)
        LOG_FILE    — path to rotating log file (default: storage/app.log)
    """
    log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    # Auto-detect format: text in dev (when DEBUG or explicit), json otherwise
    env = os.getenv("ENVIRONMENT", "production").lower()
    default_format = "text" if env in ("dev", "development", "local") else "json"
    log_format = os.getenv("LOG_FORMAT", default_format).lower()

    root = logging.getLogger()
    root.setLevel(log_level)

    # Remove any handlers already attached (e.g. from basicConfig)
    root.handlers.clear()

    # ── Console handler ───────────────────────────────────────────────────────
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(log_level)
    if log_format == "json":
        console.setFormatter(_JSONFormatter())
    else:
        console.setFormatter(logging.Formatter(
            "%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        ))
    root.addHandler(console)

    # ── Rotating file handler (WARNING+ only) ─────────────────────────────────
    log_file = os.getenv("LOG_FILE", "storage/app.log")
    Path(log_file).parent.mkdir(parents=True, exist_ok=True)
    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=10 * 1024 * 1024,   # 10 MB per file
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(logging.WARNING)
    file_handler.setFormatter(_JSONFormatter())   # always JSON in file
    root.addHandler(file_handler)

    # ── Silence noisy third-party loggers ────────────────────────────────────
    for noisy in ("httpx", "httpcore", "openai", "urllib3", "multipart"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    logging.getLogger(__name__).info(
        "Logging initialised",
        extra={"format": log_format, "level": log_level_name},
    )
