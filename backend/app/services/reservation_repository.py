"""Reservation Engine (Phase 2C, P1).

Reservations commit a batch's stock to a customer for a limited window. Hard
business rule: the reservation period may never exceed 45 days. The stored
`status` is the lifecycle state; the time-based states (expiring_soon / expired)
are computed as `effective_status` at read time. Every transition is audited.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.reservations import (
    ApproveReservationRequest,
    ConsumeReservationRequest,
    CreateReservationRequest,
    Reservation,
)

MAX_RESERVATION_DAYS = 45
EXPIRING_SOON_DAYS = 15
TERMINAL_STATUSES = {"released", "reallocated", "consumed"}


def _load() -> list[Reservation]:
    return load_collection("reservations", lambda payload: Reservation(**payload))


def _save(reservations: list[Reservation]) -> None:
    save_collection("reservations", reservations, lambda reservation: reservation.reservation_id)


def _next_id(existing: list[Reservation]) -> str:
    numbers = [
        int(r.reservation_id.split("-")[-1])
        for r in existing
        if r.reservation_id.startswith("RES-") and r.reservation_id.split("-")[-1].isdigit()
    ]
    return f"RES-{(max(numbers) + 1) if numbers else 1:04d}"


def _days_until_expiry(reservation: Reservation, today: date | None = None) -> int:
    today = today or date.today()
    try:
        return (date.fromisoformat(reservation.reservation_expiry_date) - today).days
    except ValueError:
        return 0


def effective_status(reservation: Reservation) -> str:
    if reservation.status in TERMINAL_STATUSES:
        return reservation.status
    if reservation.quantity > 0 and reservation.consumed_quantity >= reservation.quantity:
        return "consumed"
    if reservation.status in {"draft", "pending_approval"}:
        return reservation.status
    days = _days_until_expiry(reservation)
    if days < 0:
        return "expired"
    if days <= EXPIRING_SOON_DAYS:
        return "expiring_soon"
    return "active"


def _enrich(reservation: Reservation) -> Reservation:
    reservation.effective_status = effective_status(reservation)
    return reservation


def create_reservation(request: CreateReservationRequest) -> Reservation:
    if request.quantity <= 0:
        raise ValueError("Reservation quantity must be greater than zero.")
    reservation_date = date.fromisoformat(request.reservation_date) if request.reservation_date else date.today()
    max_expiry = reservation_date + timedelta(days=MAX_RESERVATION_DAYS)
    if request.reservation_expiry_date:
        expiry = date.fromisoformat(request.reservation_expiry_date)
        if expiry < reservation_date:
            raise ValueError("Reservation expiry cannot be before the reservation date.")
        if expiry > max_expiry:
            raise ValueError(
                f"Reservation period cannot exceed {MAX_RESERVATION_DAYS} days (latest expiry {max_expiry.isoformat()})."
            )
    else:
        expiry = max_expiry

    reservations = _load()
    reservation = Reservation(
        reservation_id=_next_id(reservations),
        customer=request.customer,
        distributor=request.distributor,
        item_code=request.item_code,
        batch_number=request.batch_number,
        quantity=request.quantity,
        reservation_date=reservation_date.isoformat(),
        reservation_expiry_date=expiry.isoformat(),
        status="draft",
        created_by=request.actor,
        updated_at=datetime.now().isoformat(),
    )
    _save([reservation, *reservations])
    record_audit_event(
        action="reserve",
        module_name="reservations",
        entity_name="reservation",
        entity_id=reservation.reservation_id,
        actor=request.actor,
        new_value=reservation,
    )
    return _enrich(reservation)


def list_reservations(status: str | None = None, customer: str | None = None) -> list[Reservation]:
    reservations = [_enrich(r) for r in _load()]
    if status:
        reservations = [r for r in reservations if status.lower() in {r.status.lower(), r.effective_status.lower()}]
    if customer:
        reservations = [r for r in reservations if r.customer.lower() == customer.lower()]
    return sorted(reservations, key=lambda r: r.reservation_date, reverse=True)


def get_reservation(reservation_id: str) -> Reservation | None:
    reservation = next((r for r in _load() if r.reservation_id == reservation_id), None)
    return _enrich(reservation) if reservation else None


def _transition(reservation_id: str, action: str, actor: str, mutate) -> Reservation:
    reservations = _load()
    reservation = next((r for r in reservations if r.reservation_id == reservation_id), None)
    if not reservation:
        raise ValueError(f"Reservation not found: {reservation_id}")
    old_value = reservation.model_copy()
    mutate(reservation)
    reservation.updated_at = datetime.now().isoformat()
    _save(reservations)
    record_audit_event(
        action=action,
        module_name="reservations",
        entity_name="reservation",
        entity_id=reservation_id,
        actor=actor,
        old_value=old_value,
        new_value=reservation,
    )
    return _enrich(reservation)


def submit_reservation(reservation_id: str, actor: str) -> Reservation:
    def mutate(reservation: Reservation) -> None:
        reservation.status = "pending_approval"

    return _transition(reservation_id, "reservation_submit", actor, mutate)


def approve_reservation(reservation_id: str, request: ApproveReservationRequest) -> Reservation:
    def mutate(reservation: Reservation) -> None:
        reservation.status = "active"
        reservation.approval_user = request.approval_user
        reservation.approval_date = date.today().isoformat()

    return _transition(reservation_id, "reservation_approve", request.approval_user, mutate)


def consume_reservation(reservation_id: str, request: ConsumeReservationRequest) -> Reservation:
    if request.quantity <= 0:
        raise ValueError("Consumption quantity must be greater than zero.")

    def mutate(reservation: Reservation) -> None:
        reservation.consumed_quantity = min(reservation.quantity, reservation.consumed_quantity + request.quantity)
        if reservation.consumed_quantity >= reservation.quantity:
            reservation.status = "consumed"
            reservation.consumed_date = date.today().isoformat()

    return _transition(reservation_id, "reservation_consume", request.actor, mutate)


def release_reservation(reservation_id: str, actor: str) -> Reservation:
    def mutate(reservation: Reservation) -> None:
        reservation.status = "released"

    return _transition(reservation_id, "reservation_release", actor, mutate)


def mark_reallocated(reservation_id: str, actor: str) -> Reservation:
    def mutate(reservation: Reservation) -> None:
        reservation.status = "reallocated"

    return _transition(reservation_id, "reservation_reallocated", actor, mutate)


def extend_reservation(reservation_id: str, new_expiry_date: str, actor: str) -> Reservation:
    reservation = get_reservation(reservation_id)
    if not reservation:
        raise ValueError(f"Reservation not found: {reservation_id}")
    reservation_date = date.fromisoformat(reservation.reservation_date)
    new_expiry = date.fromisoformat(new_expiry_date)
    max_expiry = reservation_date + timedelta(days=MAX_RESERVATION_DAYS)
    if new_expiry > max_expiry:
        raise ValueError(
            f"Extension cannot exceed the {MAX_RESERVATION_DAYS}-day cap (latest expiry {max_expiry.isoformat()})."
        )
    if new_expiry < date.today():
        raise ValueError("Extended expiry must be in the future.")

    def mutate(res: Reservation) -> None:
        res.reservation_expiry_date = new_expiry.isoformat()

    return _transition(reservation_id, "reservation_extend", actor, mutate)
