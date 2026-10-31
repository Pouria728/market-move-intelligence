import datetime
from contextlib import contextmanager
from decimal import Decimal
from typing import Any, Optional

import pyodbc

from . import config


def _build_connection_string() -> str:
    parts = [
        f"DRIVER={{{config.DB_DRIVER}}}",
        f"SERVER={config.DB_SERVER}",
        f"DATABASE={config.DB_NAME}",
    ]

    if config.DB_USER and config.DB_PASSWORD:
        parts.append(f"UID={config.DB_USER}")
        parts.append(f"PWD={config.DB_PASSWORD}")
    else:
        parts.append(f"Trusted_Connection={config.DB_TRUSTED_CONNECTION}")

    return ";".join(parts) + ";"


CONNECTION_STRING = _build_connection_string()


@contextmanager
def get_connection():
    conn = pyodbc.connect(CONNECTION_STRING)
    try:
        yield conn
    finally:
        conn.close()


def _normalize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime.datetime, datetime.date)):
        return value.isoformat()
    if isinstance(value, (bytes, bytearray)):
        # e.g. Market_Signals.Source_URL_Hash - internal dedupe key, not
        # something the frontend needs and not JSON-serializable as-is.
        return None
    return value


def _normalize_row(columns: list[str], row: pyodbc.Row) -> dict:
    return {column: _normalize_value(value) for column, value in zip(columns, row)}


def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        columns = [col[0] for col in cursor.description]
        return [_normalize_row(columns, row) for row in cursor.fetchall()]


def fetch_one(query: str, params: tuple = ()) -> Optional[dict]:
    rows = fetch_all(query, params)
    return rows[0] if rows else None


def fetch_all_raw(query: str, params: tuple = ()) -> list[dict]:
    """Like fetch_all, but skips value normalization (keeps real datetime /
    Decimal objects). Used internally by computations that need to do date
    math or numeric comparisons before the final JSON-safe conversion.
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(query, params)
        columns = [col[0] for col in cursor.description]
        return [dict(zip(columns, row)) for row in cursor.fetchall()]
