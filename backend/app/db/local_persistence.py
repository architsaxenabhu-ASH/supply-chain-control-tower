from __future__ import annotations

import json
import os
import sqlite3
from datetime import UTC, date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Iterable, TypeVar

from sqlalchemy import Column, Integer, MetaData, String, Table, Text, create_engine, delete, select
from sqlalchemy.engine import Engine

from app.core.config import settings


T = TypeVar("T")

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = PROJECT_ROOT / "data"

metadata = MetaData()

local_state_records = Table(
    "local_state_records",
    metadata,
    Column("collection", String(120), primary_key=True),
    Column("record_key", String(500), primary_key=True),
    Column("sort_index", Integer, nullable=False, default=0),
    Column("payload_json", Text, nullable=False),
    Column("updated_at", String(60), nullable=False),
)

audit_events = Table(
    "audit_events",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("action", String(120), nullable=False),
    Column("module_name", String(120), nullable=False),
    Column("entity_name", String(120), nullable=False),
    Column("entity_id", String(500), nullable=False),
    Column("actor", String(250), nullable=True),
    Column("reason", Text, nullable=True),
    Column("old_value_json", Text, nullable=True),
    Column("new_value_json", Text, nullable=True),
    Column("created_at", String(60), nullable=False),
)


def configured_database_url() -> str:
    legacy_sqlite_path = os.environ.get("CONTROL_TOWER_DB_PATH")
    if legacy_sqlite_path:
        return sqlite_url_from_path(Path(legacy_sqlite_path))

    database_url = os.environ.get("DATABASE_URL") or settings.database_url
    if database_url.startswith("postgres://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgres://")
    if database_url.startswith("postgresql://"):
        return "postgresql+psycopg://" + database_url.removeprefix("postgresql://")
    if database_url.startswith("sqlite:///") and not database_url.startswith("sqlite:////"):
        sqlite_path = Path(database_url.removeprefix("sqlite:///"))
        if not sqlite_path.is_absolute():
            sqlite_path = PROJECT_ROOT / sqlite_path
        return sqlite_url_from_path(sqlite_path)
    return database_url


def sqlite_url_from_path(path: Path) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{path.as_posix()}"


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = configured_database_url()
    if database_url.startswith("sqlite:///"):
        sqlite_path = Path(database_url.removeprefix("sqlite:///"))
        sqlite_path.parent.mkdir(parents=True, exist_ok=True)
        return create_engine(database_url, future=True)
    return create_engine(database_url, future=True, pool_pre_ping=True)


def init_database() -> None:
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    metadata.create_all(get_engine())


def connect() -> sqlite3.Connection:
    database_url = configured_database_url()
    if not database_url.startswith("sqlite:///"):
        raise RuntimeError("Raw sqlite connection is available only when DATABASE_URL uses SQLite.")
    sqlite_path = Path(database_url.removeprefix("sqlite:///"))
    connection = sqlite3.connect(sqlite_path)
    connection.row_factory = sqlite3.Row
    return connection


def load_collection(collection: str, factory: Callable[[dict[str, Any]], T]) -> list[T]:
    init_database()
    with get_engine().begin() as connection:
        rows = connection.execute(
            select(local_state_records.c.payload_json)
            .where(local_state_records.c.collection == collection)
            .order_by(local_state_records.c.sort_index, local_state_records.c.record_key)
        ).mappings().all()

    return [factory(json.loads(row["payload_json"])) for row in rows]


def save_collection(
    collection: str,
    records: Iterable[Any],
    key_fn: Callable[[Any], str],
) -> None:
    init_database()
    now = datetime.now(UTC).isoformat()
    rows = [
        {
            "collection": collection,
            "record_key": key_fn(record),
            "sort_index": index,
            "payload_json": json.dumps(to_json_payload(record), default=json_default),
            "updated_at": now,
        }
        for index, record in enumerate(records)
    ]

    with get_engine().begin() as connection:
        connection.execute(
            delete(local_state_records).where(local_state_records.c.collection == collection)
        )
        if rows:
            connection.execute(local_state_records.insert(), rows)


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
    with get_engine().begin() as connection:
        connection.execute(
            audit_events.insert(),
            {
                "action": action,
                "module_name": module_name,
                "entity_name": entity_name,
                "entity_id": entity_id,
                "actor": actor,
                "reason": reason,
                "old_value_json": json.dumps(to_json_payload(old_value), default=json_default)
                if old_value is not None
                else None,
                "new_value_json": json.dumps(to_json_payload(new_value), default=json_default)
                if new_value is not None
                else None,
                "created_at": datetime.now(UTC).isoformat(),
            },
        )


def database_path() -> Path | str:
    init_database()
    database_url = configured_database_url()
    if database_url.startswith("sqlite:///"):
        return Path(database_url.removeprefix("sqlite:///"))
    return database_url


def to_json_payload(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump(mode="json")
    return value


def json_default(value: Any) -> str:
    if isinstance(value, date | datetime):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")
