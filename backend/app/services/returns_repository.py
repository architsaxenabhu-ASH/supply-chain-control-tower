"""Returnable & Reusable Inventory (Phase 4, P4).

Workflow: Returned -> Inspection -> Verification -> Available (or Rejected).
Covers reusable surgical support products, unused products returned after a
procedure, and size-mismatch returns. No sterilisation workflow. Audited.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.returns import (
    CreateReturnRequest,
    ReturnDashboard,
    ReturnInspectionRequest,
    ReturnRecord,
    ReturnVerificationRequest,
)


def _load() -> list[ReturnRecord]:
    return load_collection("returns", lambda payload: ReturnRecord(**payload))


def _save(records: list[ReturnRecord]) -> None:
    save_collection("returns", records, lambda record: record.return_id)


def _next_id(existing: list[ReturnRecord]) -> str:
    numbers = [
        int(r.return_id.split("-")[-1])
        for r in existing
        if r.return_id.startswith("RET-") and r.return_id.split("-")[-1].isdigit()
    ]
    return f"RET-{(max(numbers) + 1) if numbers else 1:04d}"


def create_return(request: CreateReturnRequest) -> ReturnRecord:
    if request.returned_quantity <= 0:
        raise ValueError("Returned quantity must be greater than zero.")
    records = _load()
    record = ReturnRecord(
        return_id=_next_id(records),
        material=request.material.strip(),
        batch_number=request.batch_number,
        return_reason=request.return_reason,
        returned_quantity=request.returned_quantity,
        status="returned",
        created_by=request.actor,
        updated_at=datetime.now().isoformat(),
    )
    _save([record, *records])
    record_audit_event(
        action="return_create",
        module_name="returns",
        entity_name="return",
        entity_id=record.return_id,
        actor=request.actor,
        new_value=record,
    )
    return record


def list_returns(status: str | None = None, material: str | None = None) -> list[ReturnRecord]:
    records = _load()
    if status:
        records = [r for r in records if r.status == status.lower()]
    if material:
        records = [r for r in records if r.material.lower() == material.lower()]
    return sorted(records, key=lambda r: r.return_id, reverse=True)


def get_return(return_id: str) -> ReturnRecord | None:
    return next((r for r in _load() if r.return_id == return_id), None)


def _transition(return_id: str, action: str, actor: str, mutate) -> ReturnRecord:
    records = _load()
    record = next((r for r in records if r.return_id == return_id), None)
    if not record:
        raise ValueError(f"Return not found: {return_id}")
    old_value = record.model_copy()
    mutate(record)
    record.updated_at = datetime.now().isoformat()
    _save(records)
    record_audit_event(
        action=action,
        module_name="returns",
        entity_name="return",
        entity_id=return_id,
        actor=actor,
        old_value=old_value,
        new_value=record,
    )
    return record


def record_inspection(return_id: str, request: ReturnInspectionRequest) -> ReturnRecord:
    if request.reusable_quantity < 0 or request.rejected_quantity < 0:
        raise ValueError("Quantities cannot be negative.")

    def mutate(record: ReturnRecord) -> None:
        if request.reusable_quantity + request.rejected_quantity > record.returned_quantity:
            raise ValueError("Reusable + rejected cannot exceed the returned quantity.")
        record.inspection_result = request.inspection_result.strip().lower()
        record.reusable_quantity = request.reusable_quantity
        record.rejected_quantity = request.rejected_quantity
        record.status = "verification"

    return _transition(return_id, "return_inspection", request.actor, mutate)


def record_verification(return_id: str, request: ReturnVerificationRequest) -> ReturnRecord:
    def mutate(record: ReturnRecord) -> None:
        record.verification_result = request.verification_result.strip().lower()
        if record.verification_result == "pass":
            record.status = "available"
        else:
            record.status = "rejected"
            record.rejected_quantity = record.returned_quantity
            record.reusable_quantity = 0

    return _transition(return_id, "return_verification", request.actor, mutate)


def return_inspection_queue() -> list[ReturnRecord]:
    return [r for r in _load() if r.status in {"returned", "inspection", "verification"}]


def return_dashboard() -> ReturnDashboard:
    records = _load()
    return ReturnDashboard(
        total_returns=len(records),
        total_returned_quantity=sum(r.returned_quantity for r in records),
        reusable_quantity=sum(r.reusable_quantity for r in records if r.status == "available"),
        rejected_quantity=sum(r.rejected_quantity for r in records),
        available_quantity=sum(r.reusable_quantity for r in records if r.status == "available"),
        pending_inspection=sum(1 for r in records if r.status == "returned"),
        pending_verification=sum(1 for r in records if r.status == "verification"),
        by_reason=dict(Counter(r.return_reason or "unspecified" for r in records)),
    )
