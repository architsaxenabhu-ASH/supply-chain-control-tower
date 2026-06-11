from pydantic import BaseModel, Field

from app.schemas.receivables import PaymentEntry  # reuse - avoid duplicate model

PARTNER_TYPES = ["supplier", "3pl", "freight_forwarder", "customs_broker", "warehouse_partner", "other"]


class Payable(BaseModel):
    payable_id: str
    partner_type: str
    partner_name: str
    country: str
    invoice_number: str
    invoice_date: str
    due_date: str
    payment_terms: str | None = None
    invoice_value: float
    paid_value: float = 0
    outstanding_value: float = 0
    status: str = "open"
    payment_history: list[PaymentEntry] = Field(default_factory=list)
    created_by: str | None = None
    updated_at: str | None = None


class CreatePayableRequest(BaseModel):
    partner_type: str
    partner_name: str
    country: str
    invoice_number: str
    invoice_date: str
    due_date: str
    payment_terms: str | None = None
    invoice_value: float
    paid_value: float = 0
    actor: str


# --- P2 partner financial scorecards ------------------------------------

class PartnerFinancialScorecard(BaseModel):
    partner_name: str
    partner_type: str
    outstanding_payables: float = 0
    past_due_payables: float = 0
    average_payment_days: float | None = None
    upcoming_due_payments: float = 0
    partner_exposure: float = 0
    invoice_count: int = 0


# --- P3 payables risk ---------------------------------------------------

class PayablesRisk(BaseModel):
    partner_name: str
    partner_type: str
    risk_level: str
    outstanding_amount: float = 0
    past_due_amount: float = 0
    days_to_next_due: int | None = None
    dependency_pct: float = 0
    reasons: list[str] = Field(default_factory=list)
