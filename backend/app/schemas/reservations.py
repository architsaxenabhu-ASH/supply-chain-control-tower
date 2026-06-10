from pydantic import BaseModel


# Canonical lifecycle statuses (lowercase). Time-based states (expiring_soon /
# expired) are computed as `effective_status`, not stored.
RESERVATION_STATUSES = [
    "draft",
    "pending_approval",
    "approved",
    "active",
    "expiring_soon",
    "expired",
    "released",
    "reallocated",
    "consumed",
]


class Reservation(BaseModel):
    reservation_id: str
    customer: str
    distributor: str | None = None
    item_code: str
    batch_number: str
    quantity: float
    consumed_quantity: float = 0
    reservation_date: str
    reservation_expiry_date: str
    status: str = "draft"
    effective_status: str = "draft"
    approval_user: str | None = None
    approval_date: str | None = None
    consumed_date: str | None = None
    created_by: str | None = None
    updated_at: str | None = None


class CreateReservationRequest(BaseModel):
    customer: str
    distributor: str | None = None
    item_code: str
    batch_number: str
    quantity: float
    reservation_date: str | None = None
    reservation_expiry_date: str | None = None
    actor: str


class ApproveReservationRequest(BaseModel):
    approval_user: str


class ConsumeReservationRequest(BaseModel):
    quantity: float
    actor: str


class ReservationActionRequest(BaseModel):
    actor: str


# --- P2 consumption -----------------------------------------------------

class ReservationConsumption(BaseModel):
    reservation_id: str
    customer: str
    item_code: str
    batch_number: str
    reserved_quantity: float
    consumed_quantity: float
    remaining_quantity: float
    consumption_pct: float
    utilization_pct: float
    consumption_rate_per_day: float | None = None
    days_since_reservation: int
    days_until_expiry: int
    effective_status: str


# --- P3 risk ------------------------------------------------------------

class ReservationRisk(BaseModel):
    reservation_id: str
    customer: str
    item_code: str
    batch_number: str
    risk_level: str
    days_remaining: int
    consumption_pct: float
    quantity_remaining: float
    batch_days_to_expiry: int | None = None
    reservation_expiry_risk: bool = False
    reservation_driven_expiry_risk: bool = False
    reasons: list[str] = []


# --- P4 reallocation ----------------------------------------------------

class ReallocationRecord(BaseModel):
    reallocation_id: str
    reservation_id: str
    action: str  # reallocate | release | extend
    original_customer: str
    new_customer: str | None = None
    quantity: float
    reason: str | None = None
    approval_user: str
    approval_date: str
    created_at: str


class ReallocateRequest(BaseModel):
    reservation_id: str
    new_customer: str
    quantity: float | None = None
    reason: str | None = None
    approval_user: str


class ReleaseReservationRequest(BaseModel):
    reservation_id: str
    reason: str | None = None
    approval_user: str


class ExtendReservationRequest(BaseModel):
    reservation_id: str
    new_expiry_date: str
    reason: str | None = None
    approval_user: str


# --- P5 customer scorecards ---------------------------------------------

class CustomerConsumptionScorecard(BaseModel):
    customer: str
    reservation_count: int
    utilization_pct: float | None = None
    average_consumption_days: float | None = None
    expired_reservations: int = 0
    reallocated_reservations: int = 0


# --- P6 commitment dashboard --------------------------------------------

class CommitmentDashboard(BaseModel):
    active_reservations: int = 0
    expiring_within_15_days: int = 0
    expiring_within_5_days: int = 0
    high_risk_reservations: int = 0
    reallocation_candidates: int = 0
    reservation_value_at_risk: float = 0
