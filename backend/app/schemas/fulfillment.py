from pydantic import BaseModel, Field


class CommercialReadiness(BaseModel):
    shipment_id: str
    customer: str
    country: str
    status: str  # Ready / Waiting Payment / Waiting Inventory / Waiting Release / Waiting Shipment / Blocked
    customer_po: bool = False
    sales_order: bool = False
    payment_terms: str | None = None
    payment_ok: bool = False
    inventory_available: bool = False
    inventory_released: bool = False
    shipment_ready: bool = False
    blocking_reason: str | None = None


class OrderFulfillment(BaseModel):
    shipment_id: str
    customer: str
    fulfillment_status: str
    blocking_reason: str | None = None
    fulfillment_readiness_pct: int = 0
    expected_next_action: str
    stages: dict[str, bool] = Field(default_factory=dict)


class AllocationPriority(BaseModel):
    rank: int
    priority_tier: int
    reference: str
    customer: str
    country: str
    reason: str
    required_date: str | None = None
