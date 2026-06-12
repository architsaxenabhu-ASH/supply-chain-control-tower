from pydantic import BaseModel, Field

RECEIVABLE_STATUSES = ["open", "partially_paid", "paid", "overdue"]


class PaymentEntry(BaseModel):
    amount: float
    paid_date: str
    note: str | None = None
    actor: str | None = None


class Receivable(BaseModel):
    receivable_id: str
    distributor: str
    country: str
    invoice_number: str
    invoice_date: str
    due_date: str
    payment_terms: str | None = None
    invoice_value: float
    # Invoice currency captured from the document (None = base currency).
    currency: str | None = None
    paid_value: float = 0
    outstanding_value: float = 0
    status: str = "open"
    payment_history: list[PaymentEntry] = Field(default_factory=list)
    created_by: str | None = None
    updated_at: str | None = None


class CreateReceivableRequest(BaseModel):
    distributor: str
    country: str
    invoice_number: str
    invoice_date: str
    due_date: str
    payment_terms: str | None = None
    invoice_value: float
    currency: str | None = None
    paid_value: float = 0
    actor: str


class RecordPaymentRequest(BaseModel):
    amount: float
    paid_date: str | None = None
    note: str | None = None
    actor: str


class ReceivableUploadSummary(BaseModel):
    created: int = 0
    skipped: int = 0
    errors: list[str] = Field(default_factory=list)


# --- P2 distributor financial scorecards --------------------------------

class DistributorFinancialScorecard(BaseModel):
    distributor: str
    outstanding_amount: float = 0
    past_due_amount: float = 0
    past_due_days: int = 0
    average_collection_days: float | None = None
    credit_exposure: float = 0
    payment_trend: str = "unknown"
    invoice_count: int = 0


# --- P3 payment risk ----------------------------------------------------

class PaymentRisk(BaseModel):
    distributor: str
    risk_level: str
    outstanding_amount: float = 0
    past_due_amount: float = 0
    past_due_days: int = 0
    payment_trend: str = "unknown"
    reasons: list[str] = Field(default_factory=list)


# --- P7 credit control --------------------------------------------------

class CreditLimit(BaseModel):
    distributor: str
    credit_limit: float
    override: bool = False
    override_reason: str | None = None
    updated_by: str | None = None
    updated_at: str | None = None


class SetCreditLimitRequest(BaseModel):
    distributor: str
    credit_limit: float
    actor: str


class CreditOverrideRequest(BaseModel):
    distributor: str
    override: bool
    reason: str | None = None
    actor: str


class CreditControl(BaseModel):
    distributor: str
    credit_limit: float = 0
    outstanding_exposure: float = 0
    available_credit: float = 0
    overdue_amount: float = 0
    status: str = "healthy"
    override: bool = False
