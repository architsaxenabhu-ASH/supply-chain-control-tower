from pydantic import BaseModel, Field

APPROVAL_TYPES = [
    "reservation",
    "reallocation",
    "emergency_shipment",
    "credit_override",
    "inventory_release",
]


class Approval(BaseModel):
    approval_id: str
    approval_type: str
    reference: str | None = None
    requestor: str
    request_date: str
    approver: str | None = None
    approval_date: str | None = None
    reason: str | None = None
    outcome: str = "pending"  # pending | approved | rejected
    note: str | None = None
    created_at: str
    updated_at: str | None = None


class CreateApprovalRequest(BaseModel):
    approval_type: str
    reference: str | None = None
    reason: str | None = None
    requestor: str


class DecideApprovalRequest(BaseModel):
    outcome: str  # approved | rejected
    approver: str
    note: str | None = None


# --- P9 executive action queue ------------------------------------------

class ExecutiveAction(BaseModel):
    action_type: str
    severity: str  # critical | high | medium | low
    reference: str | None = None
    title: str
    detail: str | None = None
    source: str


# --- P10 executive decision engine --------------------------------------

class ExecutiveDecision(BaseModel):
    risk_domain: str  # inventory | distributor | payment | shipment | demand | expiry
    priority: str
    business_impact: str
    recommended_action: str
    supporting_data: dict = Field(default_factory=dict)


# --- P11 executive command center v2 ------------------------------------

class DistributorScoreRow(BaseModel):
    distributor: str
    financial_score: float | None = None
    sales_score: float | None = None
    expiry_score: float | None = None
    health_score: float | None = None


class ExecutiveCommandCenterV2(BaseModel):
    # Financial
    outstanding_receivables: float = 0
    past_due_amount: float = 0
    credit_exposure: float = 0
    top_overdue_distributors: list[str] = Field(default_factory=list)
    # Inventory
    inventory_value: float = 0
    inventory_at_risk: float = 0
    available_inventory: float = 0
    reserved_inventory: float = 0
    allocated_inventory: float = 0
    not_sellable_inventory: float = 0
    # Commercial
    orders_ready_to_ship: int = 0
    orders_blocked_by_payment: int = 0
    orders_blocked_by_inventory: int = 0
    orders_blocked_by_release: int = 0
    # Distributor
    distributor_scores: list[DistributorScoreRow] = Field(default_factory=list)
    # Management
    pending_approvals: int = 0
    critical_actions: int = 0
    escalations: int = 0
