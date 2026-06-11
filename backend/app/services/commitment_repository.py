"""Customer Commitment Engine (Phase 4, P1).

PO-level customer commitments: ordered vs allocated/shipped/delivered, with a
computed backorder quantity and status. Distinct from shipments (the fulfilment
vehicle) and demand (the signal) - this is the firm customer promise. Audited.
"""

from __future__ import annotations

from datetime import date, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.commitments import CreateCommitmentRequest, CustomerCommitment, UpdateCommitmentRequest


def _load() -> list[CustomerCommitment]:
    return load_collection("customer_commitments", lambda payload: CustomerCommitment(**payload))


def _save(records: list[CustomerCommitment]) -> None:
    save_collection("customer_commitments", records, lambda record: record.commitment_id)


def _next_id(existing: list[CustomerCommitment]) -> str:
    numbers = [
        int(c.commitment_id.split("-")[-1])
        for c in existing
        if c.commitment_id.startswith("COM-") and c.commitment_id.split("-")[-1].isdigit()
    ]
    return f"COM-{(max(numbers) + 1) if numbers else 1:04d}"


def _recompute(record: CustomerCommitment, today: date | None = None) -> CustomerCommitment:
    today = today or date.today()
    record.backorder_quantity = max(
        record.ordered_quantity - record.delivered_quantity - record.shipped_quantity - record.allocated_quantity, 0
    )
    try:
        past_required = date.fromisoformat(record.required_delivery_date) < today
    except ValueError:
        past_required = False

    has_progress = record.delivered_quantity > 0 or record.shipped_quantity > 0 or record.allocated_quantity > 0
    if record.delivered_quantity >= record.ordered_quantity:
        record.status = "fulfilled"
    elif past_required:
        record.status = "delayed"
    elif record.backorder_quantity > 0 and has_progress:
        # Worked but still short of the order = a genuine backorder. A brand-new
        # untouched order stays "open" until it is allocated/shipped.
        record.status = "backordered"
    elif has_progress:
        record.status = "partially_fulfilled"
    else:
        record.status = "open"
    return record


def create_commitment(request: CreateCommitmentRequest) -> CustomerCommitment:
    if request.ordered_quantity <= 0:
        raise ValueError("Ordered quantity must be greater than zero.")
    records = _load()
    record = CustomerCommitment(
        commitment_id=_next_id(records),
        po_number=request.po_number.strip(),
        customer=request.customer.strip(),
        distributor=request.distributor.strip(),
        country=request.country.strip(),
        material=request.material.strip(),
        batch_number=request.batch_number,
        ordered_quantity=request.ordered_quantity,
        required_delivery_date=request.required_delivery_date,
        expected_fulfillment_date=request.expected_fulfillment_date,
        created_by=request.actor,
        updated_at=datetime.now().isoformat(),
    )
    _recompute(record)
    _save([record, *records])
    record_audit_event(
        action="commitment_create",
        module_name="commitments",
        entity_name="customer_commitment",
        entity_id=record.commitment_id,
        actor=request.actor,
        new_value=record,
    )
    return record


def list_commitments(status: str | None = None, customer: str | None = None, country: str | None = None) -> list[CustomerCommitment]:
    records = [_recompute(r) for r in _load()]
    if status:
        records = [r for r in records if r.status == status.lower()]
    if customer:
        records = [r for r in records if r.customer.lower() == customer.lower()]
    if country:
        records = [r for r in records if r.country.lower() == country.lower()]
    return sorted(records, key=lambda r: r.required_delivery_date)


def get_commitment(commitment_id: str) -> CustomerCommitment | None:
    record = next((r for r in _load() if r.commitment_id == commitment_id), None)
    return _recompute(record) if record else None


def update_commitment(commitment_id: str, request: UpdateCommitmentRequest) -> CustomerCommitment:
    records = _load()
    record = next((r for r in records if r.commitment_id == commitment_id), None)
    if not record:
        raise ValueError(f"Commitment not found: {commitment_id}")
    old_value = record.model_copy()
    if request.allocated_quantity is not None:
        record.allocated_quantity = request.allocated_quantity
    if request.shipped_quantity is not None:
        record.shipped_quantity = request.shipped_quantity
    if request.delivered_quantity is not None:
        record.delivered_quantity = request.delivered_quantity
    if request.expected_fulfillment_date is not None:
        record.expected_fulfillment_date = request.expected_fulfillment_date
    record.updated_at = datetime.now().isoformat()
    _recompute(record)
    _save(records)
    record_audit_event(
        action="commitment_update",
        module_name="commitments",
        entity_name="customer_commitment",
        entity_id=commitment_id,
        actor=request.actor,
        old_value=old_value,
        new_value=record,
    )
    return record
