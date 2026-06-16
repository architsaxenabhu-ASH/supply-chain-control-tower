"""Secondary Sales document bundle store (Phase 6F). The outbound mirror of the
inbound import candidate: a bundle is uploaded, sits Pending Validation, and
only becomes an official secondary shipment once a validator approves it. Every
change is audited under module "secondary_documents"."""

from __future__ import annotations

from datetime import UTC, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.secondary_documents import (
    DecideSecondaryShipmentRequest,
    SaveSecondaryShipmentRequest,
    SecondaryShipment,
)


def _load() -> list[SecondaryShipment]:
    return load_collection("secondary_shipments", lambda payload: SecondaryShipment(**payload))


def _save(records: list[SecondaryShipment]) -> None:
    save_collection("secondary_shipments", records, lambda record: record.shipment_id)


def list_secondary_shipments(include_deleted: bool = False) -> list[SecondaryShipment]:
    records = _load()
    if not include_deleted:
        records = [record for record in records if record.status != "deleted"]
    return sorted(records, key=lambda record: record.uploaded_at, reverse=True)


def get_secondary_shipment(shipment_id: str) -> SecondaryShipment | None:
    return next((record for record in _load() if record.shipment_id == shipment_id), None)


def _generate_id(records: list[SecondaryShipment]) -> str:
    year = datetime.now(UTC).year
    prefix = f"SEC-{year}-"
    next_number = 1
    for record in records:
        if not record.shipment_id.startswith(prefix):
            continue
        try:
            next_number = max(next_number, int(record.shipment_id.removeprefix(prefix)) + 1)
        except ValueError:
            continue
    return f"{prefix}{next_number:04d}"


def save_secondary_shipment(request: SaveSecondaryShipmentRequest) -> SecondaryShipment:
    if not request.customer.strip():
        raise ValueError("Customer is required.")
    if not request.country.strip():
        raise ValueError("Country is required.")
    if not request.documents:
        raise ValueError("Upload at least one document for the shipment.")
    records = _load()
    shipment = SecondaryShipment(
        shipment_id=_generate_id(records),
        customer=request.customer.strip(),
        country=request.country.strip(),
        order_number=request.order_number.strip(),
        shipment_type=(request.shipment_type or "standard").strip(),
        status="pending_validation",
        documents=request.documents,
        uploaded_by=request.actor,
        uploaded_at=datetime.now(UTC).isoformat(),
    )
    _save([shipment, *records])
    record_audit_event(
        action="secondary_shipment_uploaded",
        module_name="secondary_documents",
        entity_name="secondary_shipment",
        entity_id=shipment.shipment_id,
        actor=request.actor,
        new_value={"customer": shipment.customer, "country": shipment.country, "documents": len(shipment.documents)},
    )
    return shipment


def _decide(shipment_id: str, request: DecideSecondaryShipmentRequest, status: str, action: str) -> SecondaryShipment:
    records = _load()
    existing = next((record for record in records if record.shipment_id == shipment_id), None)
    if existing is None:
        raise ValueError(f"Secondary shipment not found: {shipment_id}")
    if existing.status != "pending_validation":
        raise ValueError(f"Shipment is already {existing.status.replace('_', ' ')}.")
    updated = existing.model_copy(
        update={
            "status": status,
            "validated_by": request.actor,
            "validated_at": datetime.now(UTC).isoformat(),
            "note": request.note,
        }
    )
    _save([updated, *[record for record in records if record.shipment_id != shipment_id]])
    record_audit_event(
        action=action,
        module_name="secondary_documents",
        entity_name="secondary_shipment",
        entity_id=shipment_id,
        actor=request.actor,
        reason=request.note,
        old_value={"status": existing.status},
        new_value={"status": status},
    )
    return updated


def approve_secondary_shipment(shipment_id: str, request: DecideSecondaryShipmentRequest) -> SecondaryShipment:
    return _decide(shipment_id, request, "validated", "secondary_shipment_validated")


def reject_secondary_shipment(shipment_id: str, request: DecideSecondaryShipmentRequest) -> SecondaryShipment:
    return _decide(shipment_id, request, "rejected", "secondary_shipment_rejected")


def delete_secondary_shipment(shipment_id: str, request: DecideSecondaryShipmentRequest) -> SecondaryShipment:
    """Soft delete — the bundle is marked deleted (with who/when/why) but is never
    removed, so the audit trail stays intact."""
    records = _load()
    existing = next((record for record in records if record.shipment_id == shipment_id), None)
    if existing is None:
        raise ValueError(f"Secondary shipment not found: {shipment_id}")
    if existing.status == "deleted":
        raise ValueError("This shipment is already deleted.")
    updated = existing.model_copy(
        update={
            "status": "deleted",
            "deleted_by": request.actor,
            "deleted_at": datetime.now(UTC).isoformat(),
            "delete_reason": request.note,
        }
    )
    _save([updated, *[record for record in records if record.shipment_id != shipment_id]])
    record_audit_event(
        action="secondary_shipment_deleted",
        module_name="secondary_documents",
        entity_name="secondary_shipment",
        entity_id=shipment_id,
        actor=request.actor,
        reason=request.note,
        old_value={"status": existing.status},
        new_value={"status": "deleted"},
    )
    return updated
