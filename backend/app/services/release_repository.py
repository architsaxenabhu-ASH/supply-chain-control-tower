"""Release Management Engine (Phase 2B, P4).

Tracks each batch's release lifecycle (In Transit -> ... -> Available For Sale).
The hard rule: inventory is sellable ONLY after batch verification AND release
approval are both complete - reaching "Available For Sale" is gated on both.
Inventory with no completed release is reported as available-but-not-sellable.
"""

from __future__ import annotations

from datetime import datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.release import NotSellableBatch, ReleaseAdvanceRequest, ReleaseRecord
from app.services.warehouse_repository import list_inventory_batches


def _key(item_code: str, batch_number: str) -> str:
    return f"{item_code.strip().lower()}|{batch_number.strip().lower()}"


def _load() -> list[ReleaseRecord]:
    return load_collection("release_records", lambda payload: ReleaseRecord(**payload))


def _save(records: list[ReleaseRecord]) -> None:
    save_collection("release_records", records, lambda record: _key(record.item_code, record.batch_number))


def list_releases() -> list[ReleaseRecord]:
    return _load()


def get_release(item_code: str, batch_number: str) -> ReleaseRecord | None:
    target = _key(item_code, batch_number)
    return next((r for r in _load() if _key(r.item_code, r.batch_number) == target), None)


def advance_release(request: ReleaseAdvanceRequest) -> ReleaseRecord:
    records = _load()
    target = _key(request.item_code, request.batch_number)
    record = next((r for r in records if _key(r.item_code, r.batch_number) == target), None)
    if record is None:
        record = ReleaseRecord(item_code=request.item_code.strip(), batch_number=request.batch_number.strip())
        records.append(record)

    if request.batch_verified is not None:
        record.batch_verified = request.batch_verified
    if request.approved is not None:
        record.approved = request.approved
    if request.warehouse is not None:
        record.warehouse = request.warehouse

    # The sellable gate: both batch verification and approval must be complete.
    record.sellable = record.batch_verified and record.approved
    if record.sellable:
        record.status = "Available For Sale"
    elif request.status and request.status != "Available For Sale":
        record.status = request.status
    elif request.status == "Available For Sale":
        # Cannot reach Available For Sale without passing the gate.
        record.status = "Approval Pending"

    record.updated_by = request.actor
    record.updated_at = datetime.now().isoformat()
    _save(records)
    record_audit_event(
        action="release_advance",
        module_name="release",
        entity_name="release_record",
        entity_id=f"{record.item_code}/{record.batch_number}",
        actor=request.actor,
        new_value=record,
    )
    return record


def available_not_sellable() -> list[NotSellableBatch]:
    releases = {_key(r.item_code, r.batch_number): r for r in _load()}
    result: list[NotSellableBatch] = []
    for batch in list_inventory_batches():
        if batch.quantity_available <= 0 or batch.days_to_expiry < 0:
            continue
        record = releases.get(_key(batch.item_code, batch.batch_number))
        if record and record.sellable:
            continue
        if record is None:
            status, reason = "In Transit", "No release record - batch verification and approval pending"
        elif not record.batch_verified:
            status, reason = record.status, "Batch verification not complete"
        elif not record.approved:
            status, reason = record.status, "Release approval not complete"
        else:
            status, reason = record.status, "Not yet released for sale"
        result.append(
            NotSellableBatch(
                item_code=batch.item_code,
                batch_number=batch.batch_number,
                warehouse=batch.warehouse_location,
                quantity=batch.quantity_available,
                status=status,
                reason=reason,
            )
        )
    return result
