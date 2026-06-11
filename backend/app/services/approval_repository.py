"""Management Approval Engine (Phase 3C, P8).

A single approval workflow for reservations, reallocations, emergency shipments,
credit overrides, and inventory releases. Tracks requestor, approver, dates,
reason, and outcome. Every request and decision is audited.
"""

from __future__ import annotations

from datetime import date, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.executive import APPROVAL_TYPES, Approval, CreateApprovalRequest, DecideApprovalRequest


def _load() -> list[Approval]:
    return load_collection("approvals", lambda payload: Approval(**payload))


def _save(records: list[Approval]) -> None:
    save_collection("approvals", records, lambda record: record.approval_id)


def _next_id(existing: list[Approval]) -> str:
    numbers = [
        int(a.approval_id.split("-")[-1])
        for a in existing
        if a.approval_id.startswith("APR-") and a.approval_id.split("-")[-1].isdigit()
    ]
    return f"APR-{(max(numbers) + 1) if numbers else 1:04d}"


def create_approval(request: CreateApprovalRequest) -> Approval:
    approval_type = request.approval_type.strip().lower()
    if approval_type not in APPROVAL_TYPES:
        raise ValueError(f"Approval type must be one of {APPROVAL_TYPES}.")
    records = _load()
    approval = Approval(
        approval_id=_next_id(records),
        approval_type=approval_type,
        reference=request.reference,
        requestor=request.requestor,
        request_date=date.today().isoformat(),
        reason=request.reason,
        outcome="pending",
        created_at=datetime.now().isoformat(),
    )
    _save([approval, *records])
    record_audit_event(
        action="approval_request",
        module_name="approvals",
        entity_name="approval",
        entity_id=approval.approval_id,
        actor=request.requestor,
        new_value=approval,
    )
    return approval


def list_approvals(approval_type: str | None = None, outcome: str | None = None) -> list[Approval]:
    records = _load()
    if approval_type:
        records = [a for a in records if a.approval_type == approval_type.lower()]
    if outcome:
        records = [a for a in records if a.outcome == outcome.lower()]
    return sorted(records, key=lambda a: a.created_at, reverse=True)


def get_approval(approval_id: str) -> Approval | None:
    return next((a for a in _load() if a.approval_id == approval_id), None)


def decide_approval(approval_id: str, request: DecideApprovalRequest) -> Approval:
    outcome = request.outcome.strip().lower()
    if outcome not in {"approved", "rejected"}:
        raise ValueError("Outcome must be 'approved' or 'rejected'.")
    records = _load()
    approval = next((a for a in records if a.approval_id == approval_id), None)
    if not approval:
        raise ValueError(f"Approval not found: {approval_id}")
    old_value = approval.model_copy()
    approval.outcome = outcome
    approval.approver = request.approver
    approval.approval_date = date.today().isoformat()
    approval.note = request.note
    approval.updated_at = datetime.now().isoformat()
    _save(records)
    record_audit_event(
        action="approval_decision",
        module_name="approvals",
        entity_name="approval",
        entity_id=approval_id,
        actor=request.approver,
        old_value=old_value,
        new_value=approval,
    )
    return approval


def pending_approval_count() -> int:
    return sum(1 for a in _load() if a.outcome == "pending")
