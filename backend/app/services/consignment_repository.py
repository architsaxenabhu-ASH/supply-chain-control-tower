"""Consignment store (Phase 4, P3). Stock placed with a distributor that remains
ours until consumed. Tracks sent / reported / consumed / remaining and the last
report date. Audited."""

from __future__ import annotations

from datetime import date, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.consignment import ConsignmentInventory, CreateConsignmentRequest, ReportConsignmentRequest


def _load() -> list[ConsignmentInventory]:
    return load_collection("consignments", lambda payload: ConsignmentInventory(**payload))


def _save(records: list[ConsignmentInventory]) -> None:
    save_collection("consignments", records, lambda record: record.consignment_id)


def _next_id(existing: list[ConsignmentInventory]) -> str:
    numbers = [
        int(c.consignment_id.split("-")[-1])
        for c in existing
        if c.consignment_id.startswith("CNS-") and c.consignment_id.split("-")[-1].isdigit()
    ]
    return f"CNS-{(max(numbers) + 1) if numbers else 1:04d}"


def _enrich(record: ConsignmentInventory) -> ConsignmentInventory:
    record.quantity_remaining = max(record.quantity_sent - record.quantity_consumed, 0)
    return record


def create_consignment(request: CreateConsignmentRequest) -> ConsignmentInventory:
    if request.quantity_sent <= 0:
        raise ValueError("Quantity sent must be greater than zero.")
    records = _load()
    record = ConsignmentInventory(
        consignment_id=_next_id(records),
        distributor=request.distributor.strip(),
        country=request.country.strip(),
        material=request.material.strip(),
        batch_number=request.batch_number.strip(),
        quantity_sent=request.quantity_sent,
        sent_date=request.sent_date or date.today().isoformat(),
        created_by=request.actor,
        updated_at=datetime.now().isoformat(),
    )
    _enrich(record)
    _save([record, *records])
    record_audit_event(
        action="consignment_create",
        module_name="consignment",
        entity_name="consignment",
        entity_id=record.consignment_id,
        actor=request.actor,
        new_value=record,
    )
    return record


def list_consignments(distributor: str | None = None, country: str | None = None) -> list[ConsignmentInventory]:
    records = [_enrich(r) for r in _load()]
    if distributor:
        records = [r for r in records if r.distributor.lower() == distributor.lower()]
    if country:
        records = [r for r in records if r.country.lower() == country.lower()]
    return sorted(records, key=lambda r: r.sent_date)


def get_consignment(consignment_id: str) -> ConsignmentInventory | None:
    record = next((r for r in _load() if r.consignment_id == consignment_id), None)
    return _enrich(record) if record else None


def report_consignment(consignment_id: str, request: ReportConsignmentRequest) -> ConsignmentInventory:
    records = _load()
    record = next((r for r in records if r.consignment_id == consignment_id), None)
    if not record:
        raise ValueError(f"Consignment not found: {consignment_id}")
    old_value = record.model_copy()
    record.quantity_reported = request.quantity_reported
    record.quantity_consumed = request.quantity_consumed
    record.last_report_date = request.report_date or date.today().isoformat()
    record.updated_at = datetime.now().isoformat()
    _enrich(record)
    _save(records)
    record_audit_event(
        action="consignment_report",
        module_name="consignment",
        entity_name="consignment",
        entity_id=consignment_id,
        actor=request.actor,
        old_value=old_value,
        new_value=record,
    )
    return record
