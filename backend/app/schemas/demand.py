from pydantic import BaseModel, Field

DEMAND_TYPES = ["confirmed", "forecast", "tender", "opportunity"]
DEMAND_STATUSES = ["open", "active", "closed", "cancelled"]


class Demand(BaseModel):
    demand_id: str
    item_code: str
    country: str
    distributor: str
    customer: str | None = None
    demand_type: str
    demand_source: str | None = None
    quantity: float
    required_date: str | None = None
    confidence: float = 0
    status: str = "open"
    created_by: str | None = None
    updated_at: str | None = None


class CreateDemandRequest(BaseModel):
    item_code: str
    country: str
    distributor: str
    customer: str | None = None
    demand_type: str
    demand_source: str | None = None
    quantity: float
    required_date: str | None = None
    confidence: float = 0
    actor: str


class DemandStatusRequest(BaseModel):
    status: str
    actor: str


# --- P2 demand intelligence ---------------------------------------------

class ProductDemand(BaseModel):
    item_code: str
    confirmed_demand: float = 0
    forecast_demand: float = 0
    tender_demand: float = 0
    opportunity_demand: float = 0
    total_demand: float = 0
    available_inventory: float = 0
    demand_coverage_pct: float | None = None
    inventory_coverage_pct: float | None = None


class CountryDemand(BaseModel):
    country: str
    demand: float = 0
    inventory: float = 0
    reservations: float = 0
    allocations: float = 0


class DistributorDemand(BaseModel):
    distributor: str
    demand: float = 0
    consumption: float = 0
    inventory_exposure: float = 0


class DemandIntelligence(BaseModel):
    by_product: list[ProductDemand] = Field(default_factory=list)
    by_country: list[CountryDemand] = Field(default_factory=list)
    by_distributor: list[DistributorDemand] = Field(default_factory=list)


# --- P3 demand gap ------------------------------------------------------

class DemandGap(BaseModel):
    item_code: str
    total_demand: float
    physical_inventory: float
    reserved: float
    allocated: float
    available: float
    surplus: float
    shortage: float
    coverage_pct: float | None = None
    at_risk_demand: float


# --- P4 customer scorecards v2 ------------------------------------------

class CustomerScorecardV2(BaseModel):
    customer: str
    historical_sales: float = 0
    demand_history: float = 0
    reservation_history: float = 0
    consumption_history: float = 0
    allocation_history: float = 0
    reallocation_history: int = 0
    utilization_pct: float | None = None


# --- P5 distributor performance -----------------------------------------

class DistributorPerformance(BaseModel):
    distributor: str
    inventory_allocated: float = 0
    inventory_consumed: float = 0
    reservation_utilization_pct: float | None = None
    allocation_utilization_pct: float | None = None
    consumption_rate: float | None = None
    reallocation_count: int = 0
    expiry_pct: float | None = None
    active_products: int = 0
    active_customers: int = 0


# --- P6 distributor health ----------------------------------------------

class DistributorHealth(BaseModel):
    distributor: str
    health_score: float
    category: str
    consumption_rate: float | None = None
    inventory_turnover: float | None = None
    reservation_utilization_pct: float | None = None
    allocation_utilization_pct: float | None = None
    expiry_performance: float | None = None
    reallocation_performance: float | None = None
    explanation: str


# --- P7 country performance ---------------------------------------------

class CountryPerformance(BaseModel):
    country: str
    inventory_value: float = 0
    demand: float = 0
    reservations: int = 0
    allocations: int = 0
    consumption: float = 0
    expiry_risk_batches: int = 0
    shipment_on_time_pct: float | None = None


# --- P8 product intelligence --------------------------------------------

class ProductScorecard(BaseModel):
    item_code: str
    inventory: float = 0
    demand: float = 0
    reservations: float = 0
    allocations: float = 0
    consumption: float = 0
    expiry_risk_batches: int = 0
    reallocation_activity: int = 0


# --- P9 inventory efficiency --------------------------------------------

class InventoryEfficiency(BaseModel):
    physical_inventory: float = 0
    available_inventory: float = 0
    reserved_inventory: float = 0
    allocated_inventory: float = 0
    blocked_inventory: float = 0
    quarantine_inventory: float = 0
    expired_inventory: float = 0
    in_transit_inventory: float = 0
    inventory_utilization_pct: float | None = None
    inventory_at_risk_value: float = 0
    inventory_efficiency_score: float = 0


# --- P10 executive command center ---------------------------------------

class ExecutiveCommandCenter(BaseModel):
    total_inventory_value: float = 0
    inventory_at_risk_value: float = 0
    available_inventory: float = 0
    reserved_inventory: float = 0
    allocated_inventory: float = 0
    not_sellable_inventory: float = 0

    confirmed_demand: float = 0
    forecast_demand: float = 0
    tender_demand: float = 0
    opportunity_demand: float = 0
    demand_coverage_pct: float | None = None

    top_distributors: list[str] = Field(default_factory=list)
    underperforming_distributors: list[str] = Field(default_factory=list)
    high_expiry_risk_distributors: list[str] = Field(default_factory=list)

    highest_inventory_countries: list[str] = Field(default_factory=list)
    highest_demand_countries: list[str] = Field(default_factory=list)
    highest_expiry_exposure_countries: list[str] = Field(default_factory=list)

    highest_demand_products: list[str] = Field(default_factory=list)
    highest_inventory_products: list[str] = Field(default_factory=list)
    highest_expiry_risk_products: list[str] = Field(default_factory=list)

    reservation_value_at_risk: float = 0
    reservations_expiring_soon: int = 0
    reservation_reallocation_candidates: int = 0

    shipments_ready: int = 0
    shipments_delayed: int = 0
    shipments_missing_documents: int = 0
