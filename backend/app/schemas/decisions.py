from pydantic import BaseModel


class DecisionRequest(BaseModel):
    decision_type: str
    reason: str
    user: str
    role: str | None = None
    related_product: str | None = None
    related_batch: str | None = None
    related_shipment: str | None = None
    related_customer: str | None = None
    related_supplier: str | None = None
    expected_outcome: str | None = None
    status: str = "open"


class DecisionOutcomeRequest(BaseModel):
    actual_outcome: str | None = None
    status: str
    actor: str


class Decision(BaseModel):
    decision_id: str
    decision_type: str
    reason: str
    user: str
    role: str | None = None
    decided_at: str
    related_product: str | None = None
    related_batch: str | None = None
    related_shipment: str | None = None
    related_customer: str | None = None
    related_supplier: str | None = None
    expected_outcome: str | None = None
    actual_outcome: str | None = None
    status: str = "open"
