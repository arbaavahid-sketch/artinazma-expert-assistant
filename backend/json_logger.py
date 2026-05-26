"""
Structured JSON logging formatter for production.
Usage:
    from json_logger import setup_json_logging
    setup_json_logging()  # call once at startup
"""

import json
import logging
import os
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Outputs each log record as a single JSON line."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = self.formatException(record.exc_info)
        # Include extra fields if any
        for key in ("request_id", "customer_id", "endpoint", "method", "status_code", "duration_ms"):
            if hasattr(record, key):
                log_entry[key] = getattr(record, key)
        return json.dumps(log_entry, ensure_ascii=False)


def setup_json_logging(level: int = logging.INFO):
    """
    Replace default log formatting with JSON when ENVIRONMENT != 'development'.
    In development, keep human-readable format for convenience.
    """
    env = os.getenv("ENVIRONMENT", "production").lower()
    if env == "development":
        # Human-readable in dev
        logging.basicConfig(
            level=level,
            format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            force=True,
        )
        return

    root = logging.getLogger()
    root.setLevel(level)

    # Remove existing handlers
    for handler in root.handlers[:]:
        root.removeHandler(handler)

    # JSON to stdout
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(JSONFormatter())
    root.addHandler(stream_handler)
