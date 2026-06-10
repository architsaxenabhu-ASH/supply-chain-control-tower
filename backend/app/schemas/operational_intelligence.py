from pydantic import BaseModel, Field


# --- P1 Document Readiness ----------------------------------------------

class DocumentReadiness(BaseModel):
    import_file_number: str
    shipment_name: str | None = None
    destination_country: str
    readiness_pct: int = 0
    documents_present: list[str] = Field(default_factory=list)
    missing_documents: list[str] = Field(default_factory=list)
    missing_mandatory_fields: int = 0
    correction_count: int = 0
    validation_status: str
    status: str


# --- P2 Document Control Tower ------------------------------------------

class DocumentAgingBuckets(BaseModel):
    days_0_1: int = 0
    days_2_3: int = 0
    days_4_7: int = 0
    days_8_14: int = 0
    days_14_plus: int = 0


class DocumentControlTower(BaseModel):
    documents_pending: int = 0
    documents_missing: int = 0
    documents_corrected: int = 0
    documents_approved: int = 0
    average_processing_days: float | None = None
    aging: DocumentAgingBuckets = Field(default_factory=DocumentAgingBuckets)
    bottlenecks: list[str] = Field(default_factory=list)


# --- P3 Shipment Delay Intelligence -------------------------------------

class ShipmentDelayInsight(BaseModel):
    import_file_number: str
    shipment_name: str | None = None
    carrier: str | None = None
    route: str | None = None
    country: str
    planned_date: str | None = None
    actual_date: str | None = None
    delay_days: int = 0
    delay_category: str | None = None
    delay_reason: str | None = None
    root_cause: str | None = None
    is_delayed: bool = False


class DelayReasonRequest(BaseModel):
    import_file_number: str
    delay_category: str
    delay_reason: str | None = None
    root_cause: str | None = None
    actor: str


# --- P5 Expiry Prevention -----------------------------------------------

class ExpiryPreventionBuckets(BaseModel):
    under_6_months: int = 0
    months_6_12: int = 0
    months_12_24: int = 0
    over_24_months: int = 0
    expired: int = 0


class ExpiryRiskBatch(BaseModel):
    item_code: str
    batch_number: str
    warehouse: str
    expiry_date: str
    days_to_expiry: int
    quantity: float
    value: float
    risk_score: int


class ExpiryPrevention(BaseModel):
    buckets: ExpiryPreventionBuckets = Field(default_factory=ExpiryPreventionBuckets)
    inventory_at_risk_value: float = 0
    average_risk_score: float = 0
    soonest_products: list[ExpiryRiskBatch] = Field(default_factory=list)
    soonest_batches: list[ExpiryRiskBatch] = Field(default_factory=list)
