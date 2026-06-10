"""Reallocation Workflow (Phase 2C, P4).

When a reservation is expiring, management can Reallocate (move the commitment
to another customer), Release (free the stock), or Extend (within the 45-day
cap). Every action stores original/new customer, quantity, reason, and approver,
and is audited. Reallocation moves the commitment by creating a fresh approved
reservation for the new customer."""

from __future__ import annotations

from datetime import date, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.reservations import (
    ApproveReservationRequest,
    CreateReservationRequest,
    ExtendReservationRequest,
    ReallocateRequest,
    ReallocationRecord,
    ReleaseReservationRequest,
)
from app.services.reservation_repository import (
    approve_reservation,
    create_reservation,
    extend_reservation,
    get_reservation,
    mark_reallocated,
    release_reservation,
)


def _load() -> list[ReallocationRecord]:
    return load_collection("reallocations", lambda payload: ReallocationRecord(**payload))


def _save(records: list[ReallocationRecord]) -> None:
    save_collection("reallocations", records, lambda record: record.reallocation_id)


def _next_id(existing: list[ReallocationRecord]) -> str:
    numbers = [
        int(r.reallocation_id.split("-")[-1])
        for r in existing
        if r.reallocation_id.startswith("REA-") and r.reallocation_id.split("-")[-1].isdigit()
    ]
    return f"REA-{(max(numbers) + 1) if numbers else 1:04d}"


def list_reallocations() -> list[ReallocationRecord]:
    return sorted(_load(), key=lambda r: r.created_at, reverse=True)


def _record(action, reservation, new_customer, quantity, reason, approval_user) -> ReallocationRecord:
    records = _load()
    record = ReallocationRecord(
        reallocation_id=_next_id(records),
        reservation_id=reservation.reservation_id,
        action=action,
        original_customer=reservation.customer,
        new_customer=new_customer,
        quantity=quantity,
        reason=reason,
        approval_user=approval_user,
        approval_date=date.today().isoformat(),
        created_at=datetime.now().isoformat(),
    )
    _save([record, *records])
    record_audit_event(
        action=f"reallocation_{action}",
        module_name="reallocations",
        entity_name="reallocation",
        entity_id=record.reallocation_id,
        actor=approval_user,
        new_value=record,
    )
    return record


def reallocate(request: ReallocateRequest) -> ReallocationRecord:
    reservation = get_reservation(request.reservation_id)
    if not reservation:
        raise ValueError(f"Reservation not found: {request.reservation_id}")
    quantity = request.quantity or (reservation.quantity - reservation.consumed_quantity)
    record = _record("reallocate", reservation, request.new_customer, quantity, request.reason, request.approval_user)

    # Move the commitment: close the original and open a fresh approved reservation
    # for the new customer (new 45-day window starts today).
    mark_reallocated(reservation.reservation_id, request.approval_user)
    new_reservation = create_reservation(
        CreateReservationRequest(
            customer=request.new_customer,
            distributor=reservation.distributor,
            item_code=reservation.item_code,
            batch_number=reservation.batch_number,
            quantity=quantity,
            actor=request.approval_user,
        )
    )
    approve_reservation(new_reservation.reservation_id, ApproveReservationRequest(approval_user=request.approval_user))
    return record


def release(request: ReleaseReservationRequest) -> ReallocationRecord:
    reservation = get_reservation(request.reservation_id)
    if not reservation:
        raise ValueError(f"Reservation not found: {request.reservation_id}")
    quantity = reservation.quantity - reservation.consumed_quantity
    record = _record("release", reservation, None, quantity, request.reason, request.approval_user)
    release_reservation(reservation.reservation_id, request.approval_user)
    return record


def extend(request: ExtendReservationRequest) -> ReallocationRecord:
    reservation = get_reservation(request.reservation_id)
    if not reservation:
        raise ValueError(f"Reservation not found: {request.reservation_id}")
    # extend_reservation enforces the 45-day cap and raises ValueError otherwise.
    extend_reservation(reservation.reservation_id, request.new_expiry_date, request.approval_user)
    quantity = reservation.quantity - reservation.consumed_quantity
    return _record("extend", reservation, reservation.customer, quantity, request.reason, request.approval_user)
