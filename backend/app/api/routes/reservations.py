from fastapi import APIRouter, HTTPException, Query

from app.schemas.reservations import (
    ApproveReservationRequest,
    CommitmentDashboard,
    ConsumeReservationRequest,
    CreateReservationRequest,
    CustomerConsumptionScorecard,
    Reservation,
    ReservationActionRequest,
    ReservationConsumption,
    ReservationRisk,
)
from app.services.reservation_intelligence import (
    commitment_dashboard,
    customer_consumption,
    reservation_consumption,
    reservation_risk,
)
from app.services.reservation_repository import (
    approve_reservation,
    consume_reservation,
    create_reservation,
    get_reservation,
    list_reservations,
    release_reservation,
    submit_reservation,
)

reservations_router = APIRouter()
consumption_router = APIRouter()
risk_router = APIRouter()
customer_consumption_router = APIRouter()
commitment_router = APIRouter()


@reservations_router.get("", response_model=list[Reservation])
def reservations(
    status: str | None = Query(default=None),
    customer: str | None = Query(default=None),
) -> list[Reservation]:
    return list_reservations(status=status, customer=customer)


@reservations_router.post("", response_model=Reservation)
def create(request: CreateReservationRequest) -> Reservation:
    try:
        return create_reservation(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@reservations_router.get("/{reservation_id}", response_model=Reservation)
def detail(reservation_id: str) -> Reservation:
    reservation = get_reservation(reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail=f"Reservation not found: {reservation_id}")
    return reservation


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@reservations_router.post("/{reservation_id}/submit", response_model=Reservation)
def submit(reservation_id: str, request: ReservationActionRequest) -> Reservation:
    return _guard(lambda: submit_reservation(reservation_id, request.actor))


@reservations_router.post("/{reservation_id}/approve", response_model=Reservation)
def approve(reservation_id: str, request: ApproveReservationRequest) -> Reservation:
    return _guard(lambda: approve_reservation(reservation_id, request))


@reservations_router.post("/{reservation_id}/consume", response_model=Reservation)
def consume(reservation_id: str, request: ConsumeReservationRequest) -> Reservation:
    return _guard(lambda: consume_reservation(reservation_id, request))


@reservations_router.post("/{reservation_id}/release", response_model=Reservation)
def release(reservation_id: str, request: ReservationActionRequest) -> Reservation:
    return _guard(lambda: release_reservation(reservation_id, request.actor))


@consumption_router.get("", response_model=list[ReservationConsumption])
def consumption() -> list[ReservationConsumption]:
    return reservation_consumption()


@risk_router.get("", response_model=list[ReservationRisk])
def risk() -> list[ReservationRisk]:
    return reservation_risk()


@customer_consumption_router.get("", response_model=list[CustomerConsumptionScorecard])
def customer_scorecards() -> list[CustomerConsumptionScorecard]:
    return customer_consumption()


@commitment_router.get("", response_model=CommitmentDashboard)
def commitment() -> CommitmentDashboard:
    return commitment_dashboard()
