from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import time
from datetime import UTC, date, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Iterable, TypeVar

from sqlalchemy import Column, Integer, MetaData, String, Table, Text, create_engine, delete, desc, inspect as sqla_inspect, select, text
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
    # Tamper-evident chain: sha256(previous_event_hash + "|" + this event's fields).
    Column("event_hash", String(64), nullable=True),
    # Attribution: who (role) and from which screen the action originated.
    Column("actor_role", String(120), nullable=True),
    Column("source_screen", String(120), nullable=True),
)


_AUDIT_OPTIONAL_COLUMNS = {
    "event_hash": "VARCHAR(64)",
    "actor_role": "VARCHAR(120)",
    "source_screen": "VARCHAR(120)",
}


AUDIT_GENESIS_HASH = "GENESIS"
_audit_migration_done = False


def _ensure_audit_columns() -> None:
    """Add hash/attribution columns to pre-existing audit tables (SQLite/Postgres)."""
    global _audit_migration_done
    if _audit_migration_done:
        return
    engine = get_engine()
    columns = {column["name"] for column in sqla_inspect(engine).get_columns("audit_events")}
    missing = {name: ddl for name, ddl in _AUDIT_OPTIONAL_COLUMNS.items() if name not in columns}
    if missing:
        with engine.begin() as connection:
            for name, ddl in missing.items():
                connection.execute(text(f"ALTER TABLE audit_events ADD COLUMN {name} {ddl}"))
    _audit_migration_done = True


def _audit_canonical(row: dict[str, Any]) -> str:
    return "|".join(
        str(row.get(field) or "")
        for field in (
            "action",
            "module_name",
            "entity_name",
            "entity_id",
            "actor",
            "reason",
            "old_value_json",
            "new_value_json",
            "created_at",
            "actor_role",
            "source_screen",
        )
    )


def _audit_hash(previous_hash: str, row: dict[str, Any]) -> str:
    return hashlib.sha256(f"{previous_hash}|{_audit_canonical(row)}".encode("utf-8")).hexdigest()


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


_schema_initialized = False

# Short-TTL read cache. The JSON-blob store loads a whole collection per call,
# and composed intelligence endpoints reload the same collections many times;
# on a high-latency database that is the dominant cost. Caches are invalidated
# immediately on our own writes, so staleness only ever reflects external writes
# and is bounded by the TTL.
_CACHE_TTL_SECONDS = 15.0
_collection_cache: dict[str, tuple[float, list[str]]] = {}
_audit_cache: dict[int, tuple[float, list[dict[str, Any]]]] = {}


def _cache_fresh(entry: tuple[float, Any] | None) -> bool:
    return entry is not None and (time.monotonic() - entry[0]) < _CACHE_TTL_SECONDS


def init_database() -> None:
    # Create the schema once per process. This is called on every persistence
    # operation; on Postgres an unguarded create_all() runs catalog inspection
    # each time, which made composed endpoints (hundreds of loads) crawl.
    global _schema_initialized
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    if _schema_initialized:
        return
    metadata.create_all(get_engine())
    _schema_initialized = True


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
    cached = _collection_cache.get(collection)
    if _cache_fresh(cached):
        payloads = cached[1]
    else:
        with get_engine().begin() as connection:
            rows = connection.execute(
                select(local_state_records.c.payload_json)
                .where(local_state_records.c.collection == collection)
                .order_by(local_state_records.c.sort_index, local_state_records.c.record_key)
            ).mappings().all()
        payloads = [row["payload_json"] for row in rows]
        _collection_cache[collection] = (time.monotonic(), payloads)

    return [factory(json.loads(payload)) for payload in payloads]


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
    _collection_cache.pop(collection, None)


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
    _ensure_audit_columns()
    from app.core.audit_context import current_actor_email, current_actor_role, current_source_screen

    row = {
        "action": action,
        "module_name": module_name,
        "entity_name": entity_name,
        "entity_id": entity_id,
        "actor": actor or current_actor_email(),
        "reason": reason,
        "old_value_json": json.dumps(to_json_payload(old_value), default=json_default)
        if old_value is not None
        else None,
        "new_value_json": json.dumps(to_json_payload(new_value), default=json_default)
        if new_value is not None
        else None,
        "created_at": datetime.now(UTC).isoformat(),
        "actor_role": current_actor_role(),
        "source_screen": current_source_screen(),
    }
    with get_engine().begin() as connection:
        previous_hash = connection.execute(
            select(audit_events.c.event_hash)
            .where(audit_events.c.event_hash.is_not(None))
            .order_by(desc(audit_events.c.id))
            .limit(1)
        ).scalar() or AUDIT_GENESIS_HASH
        row["event_hash"] = _audit_hash(previous_hash, row)
        connection.execute(audit_events.insert(), row)
    _audit_cache.clear()


def verify_audit_chain() -> dict[str, Any]:
    """Recompute the hash chain and report whether the audit trail is intact.
    Any edit or deletion of a recorded event breaks the chain at that point."""
    init_database()
    _ensure_audit_columns()
    with get_engine().begin() as connection:
        rows = connection.execute(
            select(audit_events).order_by(audit_events.c.id)
        ).mappings().all()

    previous_hash = AUDIT_GENESIS_HASH
    verified = 0
    legacy = 0
    for row in rows:
        stored = row["event_hash"]
        if stored is None:
            legacy += 1
            continue
        expected = _audit_hash(previous_hash, dict(row))
        if expected != stored:
            return {
                "valid": False,
                "broken_at_id": row["id"],
                "verified_count": verified,
                "legacy_unhashed_count": legacy,
                "total": len(rows),
            }
        verified += 1
        previous_hash = stored

    return {
        "valid": True,
        "broken_at_id": None,
        "verified_count": verified,
        "legacy_unhashed_count": legacy,
        "total": len(rows),
    }


def list_audit_events(limit: int = 100) -> list[dict[str, Any]]:
    init_database()
    _ensure_audit_columns()
    safe_limit = max(1, min(limit, 500))
    cached = _audit_cache.get(safe_limit)
    if _cache_fresh(cached):
        return cached[1]

    with get_engine().begin() as connection:
        rows = connection.execute(
            select(audit_events)
            .order_by(desc(audit_events.c.id))
            .limit(safe_limit)
        ).mappings().all()

    events = [
        {
            "id": row["id"],
            "action": row["action"],
            "module_name": row["module_name"],
            "entity_name": row["entity_name"],
            "entity_id": row["entity_id"],
            "actor": row["actor"],
            "reason": row["reason"],
            "old_value": parse_json_value(row["old_value_json"]),
            "new_value": parse_json_value(row["new_value_json"]),
            "created_at": row["created_at"],
            "event_hash": row["event_hash"],
            "actor_role": row["actor_role"],
            "source_screen": row["source_screen"],
        }
        for row in rows
    ]
    _audit_cache[safe_limit] = (time.monotonic(), events)
    return events


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


def parse_json_value(value: str | None) -> Any:
    if value is None:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return value


def json_default(value: Any) -> str:
    if isinstance(value, date | datetime):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")
