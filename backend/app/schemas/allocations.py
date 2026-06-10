from pydantic import BaseModel, Field

ALLOCATION_STATUSES = ["draft", "approved", "active", "consumed", "released", "reallocated"]


class Allocation(BaseModel):
    allocation_id: str
    item_code: str
    vertical: str | None = None
    country: str
    distributor: str
    customer: str | None = None
    batch_number: str
    quantity: float
    consumed_quantity: float = 0
    allocation_date: str
    status: str = "draft"
    approval_user: str | None = None
    approval_date: str | None = None
    created_by: str | None = None
    updated_at: str | None = None


class CreateAllocationRequest(BaseModel):
    item_code: str
    country: str
    distributor: str
    customer: str | None = None
    batch_number: str
    quantity: float
    allocation_date: str | None = None
    actor: str


class ApproveAllocationRequest(BaseModel):
    approval_user: str


class ConsumeAllocationRequest(BaseModel):
    quantity: float
    actor: str


class AllocationActionRequest(BaseModel):
    actor: str


# --- P2 single source of truth ------------------------------------------

class InventoryCommitment(BaseModel):
    physical_inventory: float = 0
    available_inventory: float = 0
    reserved_inventory: float = 0
    allocated_inventory: float = 0
    blocked_inventory: float = 0
    quarantine_inventory: float = 0
    expired_inventory: float = 0
    in_transit_inventory: float = 0
    physical_value: float = 0
    available_value: float = 0


# --- P3 distributor scorecards ------------------------------------------

class DistributorScorecard(BaseModel):
    distributor: str
    inventory_allocated: float = 0
    inventory_consumed: float = 0
    allocation_utilization_pct: float | None = None
    reservation_utilization_pct: float | None = None
    reallocation_count: int = 0
    expiry_pct: float | None = None
    active_products: int = 0
    active_batches: int = 0


# --- P4 country scorecards ----------------------------------------------

class CountryScorecard(BaseModel):
    country: str
    inventory_value: float = 0
    reservations: int = 0
    allocations: int = 0
    consumption: float = 0
    expiry_risk_batches: int = 0
    shipment_on_time_pct: float | None = None


# --- P5 recommendations -------------------------------------------------

class AllocationRecommendation(BaseModel):
    item_code: str | None = None
    recommended_country: str
    recommended_distributor: str
    recommendation_score: float
    explanation: str


# --- P6 allocation dashboard --------------------------------------------

class AllocationDashboard(BaseModel):
    active_allocations: int = 0
    allocation_value: float = 0
    allocation_utilization_pct: float | None = None
    reallocation_candidates: int = 0
    country_exposure: dict[str, float] = Field(default_factory=dict)
    distributor_exposure: dict[str, float] = Field(default_factory=dict)
    inventory_locked_in_allocations: float = 0
