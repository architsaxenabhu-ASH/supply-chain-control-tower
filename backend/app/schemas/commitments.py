from pydantic import BaseModel, Field

COMMITMENT_STATUSES = ["open", "partially_fulfilled", "fulfilled", "delayed", "backordered"]


class CustomerCommitment(BaseModel):
    commitment_id: str
    po_number: str
    customer: str
    distributor: str
    country: str
    material: str
    batch_number: str | None = None
    ordered_quantity: float
    allocated_quantity: float = 0
    shipped_quantity: float = 0
    delivered_quantity: float = 0
    backorder_quantity: float = 0
    required_delivery_date: str
    expected_fulfillment_date: str | None = None
    status: str = "open"
    created_by: str | None = None
    updated_at: str | None = None


class CreateCommitmentRequest(BaseModel):
    po_number: str
    customer: str
    distributor: str
    country: str
    material: str
    batch_number: str | None = None
    ordered_quantity: float
    required_delivery_date: str
    expected_fulfillment_date: str | None = None
    actor: str


class UpdateCommitmentRequest(BaseModel):
    allocated_quantity: float | None = None
    shipped_quantity: float | None = None
    delivered_quantity: float | None = None
    expected_fulfillment_date: str | None = None
    actor: str


class CommitmentRisk(BaseModel):
    commitment_id: str
    po_number: str
    customer: str
    material: str
    risk_level: str
    fill_rate_pct: float
    otif: bool
    delay_days: int
    backorder_quantity: float
    backorder_value: float
    inventory_available: float
    inventory_incoming: float
    days_to_required: int
    reasons: list[str] = Field(default_factory=list)


class CommitmentDashboard(BaseModel):
    total_commitments: int = 0
    open_commitments: int = 0
    fulfilled_commitments: int = 0
    delayed_commitments: int = 0
    backordered_commitments: int = 0
    average_fill_rate_pct: float | None = None
    otif_pct: float | None = None
    total_backorder_value: float = 0
    high_risk_commitments: int = 0
