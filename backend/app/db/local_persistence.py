from __future__ import annotations

import json
import os
import sqlite3
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any, Callable, Iterable, TypeVar


T = TypeVar("T")

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = PROJECT_ROOT / "data"
DATABASE_PATH = Path(os.environ.get("CONTROL_TOWER_DB_PATH", DATA_ROOT / "control_tower.db"))


def init_database() -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    with connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS local_state_records (
                collection TEXT NOT NULL,
                record_key TEXT NOT NULL,
                sort_index INTEGER NOT NULL DEFAULT 0,
                payload_json TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (collection, record_key)
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS audit_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                action TEXT NOT NULL,
                module_name TEXT NOT NULL,
                entity_name TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                actor TEXT,
                reason TEXT,
                old_value_json TEXT,
                new_value_json TEXT,
                created_at TEXT NOT NULL
            )
            """
        )


def connect() -> sqlite3.Connection:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def load_collection(collection: str, factory: Callable[[dict[str, Any]], T]) -> list[T]:
    init_database()
    with connect() as connection:
        rows = connection.execute(
            """
            SELECT payload_json
            FROM local_state_records
            WHERE collection = ?
            ORDER BY sort_index, record_key
            """,
            (collection,),
        ).fetchall()

    return [factory(json.loads(row["payload_json"])) for row in rows]


def save_collection(
    collection: str,
    records: Iterable[Any],
    key_fn: Callable[[Any], str],
) -> None:
    init_database()
    now = datetime.now(UTC).isoformat()
    with connect() as connection:
        connection.execute(
            "DELETE FROM local_state_records WHERE collection = ?",
            (collection,),
        )
        connection.executemany(
            """
            INSERT INTO local_state_records (
                collection,
                record_key,
                sort_index,
                payload_json,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    collection,
                    key_fn(record),
                    index,
                    json.dumps(to_json_payload(record), default=json_default),
                    now,
                )
                for index, record in enumerate(records)
            ],
        )


def record_audit_event(
    *,
    action: str,
    module_name: str,
    entity_name: str,
    entity_id: str,
    actor: str | None = None,
    reason: str | None = None,
    old_value: Any | None = None,
    new_value: Any | None = None,
) -> None:
    init_database()
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO audit_events (
                action,
                module_name,
                entity_name,
                entity_id,
                actor,
                reason,
                old_value_json,
                new_value_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                action,
                module_name,
                entity_name,
                entity_id,
                actor,
                reason,
                json.dumps(to_json_payload(old_value), default=json_default) if old_value is not None else None,
                json.dumps(to_json_payload(new_value), default=json_default) if new_value is not None else None,
                datetime.now(UTC).isoformat(),
            ),
        )


def database_path() -> Path:
    init_database()
    return DATABASE_PATH


def to_json_payload(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    return value


def json_default(value: Any) -> str:
    if isinstance(value, date | datetime):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")
