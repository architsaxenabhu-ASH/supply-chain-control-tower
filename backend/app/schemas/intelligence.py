from pydantic import BaseModel, Field


# --- Inventory intelligence (Priority 1) ---------------------------------

class InventoryStatusBreakdown(BaseModel):
    available_quantity: float = 0
    reserved_quantity: float = 0
    blocked_quantity: float = 0
    quarantine_quantity: float = 0
    expired_quantity: float = 0
    total_quantity: float = 0
    available_value: float = 0
    total_value: float = 0
    batch_count: int = 0


class InventoryHealthItem(BaseModel):
    item_code: str
    on_hand: float
    avg_daily_consumption: float
    days_of_coverage: float | None = None
    oldest_age_days: int = 0
    last_movement_days: int | None = None
    category: str = "healthy"


class InventoryHealth(BaseModel):
    items: list[InventoryHealthItem] = Field(default_factory=list)
    healthy: int = 0
    slow_moving: int = 0
    dead_stock: int = 0
    excess: int = 0
    stockout_risk: int = 0
    aging_0_90: int = 0
    aging_91_180: int = 0
    aging_181_365: int = 0
    aging_over_365: int = 0


class InventoryHoldRequest(BaseModel):
    item_code: str
    batch_number: str
    hold_type: str  # blocked | quarantine | release
    actor: str


# --- Expiry engine (Priority 2) ------------------------------------------

class ExpiryBucketCounts(BaseModel):
    bucket_0_30: int = 0
    bucket_31_60: int = 0
    bucket_61_90: int = 0
    bucket_91_180: int = 0
    bucket_180_plus: int = 0
    expired: int = 0


class ExpiryRiskItem(BaseModel):
    item_code: str
    batch_number: str
    warehouse: str
    expiry_date: str
    days_to_expiry: int
    quantity: float
    value: float
    risk_score: int


class ExpiryLevelGroup(BaseModel):
    key: str
    expiring_90: int
    value_at_risk_90: float


class ExpiryEngineResponse(BaseModel):
    buckets: ExpiryBucketCounts
    value_at_risk_90: float = 0
    soonest_products: list[ExpiryRiskItem] = Field(default_factory=list)
    soonest_batches: list[ExpiryRiskItem] = Field(default_factory=list)
    by_warehouse: list[ExpiryLevelGroup] = Field(default_factory=list)
    by_country: list[ExpiryLevelGroup] = Field(default_factory=list)
    by_product: list[ExpiryLevelGroup] = Field(default_factory=list)


# --- Event engine (Priority 4) -------------------------------------------

class BusinessEvent(BaseModel):
    event_id: int
    event_type: str
    timestamp: str
    user: str | None = None
    user_role: str | None = None
    source_screen: str | None = None
    related_entity: str
    related_record: str


class EventFeed(BaseModel):
    events: list[BusinessEvent] = Field(default_factory=list)
    total: int = 0
    by_type: dict[str, int] = Field(default_factory=dict)


# --- System health (Priority 5) ------------------------------------------

class SystemHealth(BaseModel):
    total_users: int = 0
    total_products: int = 0
    total_documents: int = 0
    ocr_success_rate: float = 0
    validation_queue_size: int = 0
    open_shipments: int = 0
    inventory_records: int = 0
    learning_rules: int = 0
    audit_events: int = 0
    audit_chain_valid: bool = True
    database_health: str = "ok"
