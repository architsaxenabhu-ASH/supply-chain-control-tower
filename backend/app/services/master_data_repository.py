"""Master data governance registry.

One governance layer for every master entity (products, customers, suppliers,
warehouses, carriers, countries): active/inactive status, duplicate detection,
and created/updated attribution. Change history is the hash-chained audit trail
(every upsert/status change is recorded), so it is tamper-evident too.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.db.local_persistence import list_audit_events, load_collection, record_audit_event, save_collection
from app.schemas.master_data import (
    DuplicateCheckResponse,
    MasterRecord,
    SetMasterStatusRequest,
    UpsertMasterRecordRequest,
)


def _record_key(entity_type: str, code: str) -> str:
    return f"{entity_type.strip().lower()}|{code.strip().lower()}"


def _entity_id(entity_type: str, code: str) -> str:
    return f"{entity_type.strip().lower()}:{code.strip()}"


def _load() -> list[MasterRecord]:
    return load_collection("master_records", lambda payload: MasterRecord(**payload))


def _save(records: list[MasterRecord]) -> None:
    save_collection("master_records", records, lambda record: _record_key(record.entity_type, record.code))


def get_master_record(entity_type: str, code: str) -> MasterRecord | None:
    key = _record_key(entity_type, code)
    return next((r for r in _load() if _record_key(r.entity_type, r.code) == key), None)


def list_master_records(entity_type: str | None = None, active_only: bool = False) -> list[MasterRecord]:
    records = _load()
    if entity_type:
        records = [r for r in records if r.entity_type.lower() == entity_type.lower()]
    if active_only:
        records = [r for r in records if r.is_active]
    return sorted(records, key=lambda r: (r.entity_type, r.code))


def check_duplicate(entity_type: str, code: str) -> DuplicateCheckResponse:
    existing = get_master_record(entity_type, code)
    return DuplicateCheckResponse(
        entity_type=entity_type,
        code=code,
        is_duplicate=existing is not None,
        existing=existing,
    )


def upsert_master_record(request: UpsertMasterRecordRequest) -> MasterRecord:
    if not request.code.strip() or not request.name.strip():
        raise ValueError("Master record code and name are mandatory.")

    records = _load()
    key = _record_key(request.entity_type.value, request.code)
    now = datetime.now()
    existing = next((r for r in records if _record_key(r.entity_type, r.code) == key), None)

    if existing:
        action = "update"
        old_value = existing.model_copy()
        existing.name = request.name
        existing.attributes = request.attributes
        existing.is_active = request.is_active
        existing.updated_by = request.actor
        existing.updated_at = now
        record = existing
    else:
        action = "create"
        old_value = None
        record = MasterRecord(
            entity_type=request.entity_type.value,
            code=request.code.strip(),
            name=request.name.strip(),
            is_active=request.is_active,
            attributes=request.attributes,
            created_by=request.actor,
            created_at=now,
            updated_by=request.actor,
            updated_at=now,
        )
        records.append(record)

    _save(records)
    record_audit_event(
        action=action,
        module_name="master_data",
        entity_name=request.entity_type.value,
        entity_id=_entity_id(request.entity_type.value, request.code),
        actor=request.actor,
        old_value=old_value,
        new_value=record,
    )
    return record


def set_master_status(request: SetMasterStatusRequest) -> MasterRecord:
    record = get_master_record(request.entity_type.value, request.code)
    if not record:
        raise ValueError(f"Master record not found: {request.entity_type.value}/{request.code}")

    records = _load()
    target = next(r for r in records if _record_key(r.entity_type, r.code) == _record_key(record.entity_type, record.code))
    old_value = target.model_copy()
    target.is_active = request.is_active
    target.updated_by = request.actor
    target.updated_at = datetime.now()
    _save(records)
    record_audit_event(
        action="activate" if request.is_active else "deactivate",
        module_name="master_data",
        entity_name=request.entity_type.value,
        entity_id=_entity_id(request.entity_type.value, request.code),
        actor=request.actor,
        old_value=old_value,
        new_value=target,
    )
    return target


def master_record_history(entity_type: str, code: str) -> list[dict[str, Any]]:
    entity_id = _entity_id(entity_type, code)
    return [event for event in list_audit_events(limit=500) if event.get("entity_id") == entity_id]
