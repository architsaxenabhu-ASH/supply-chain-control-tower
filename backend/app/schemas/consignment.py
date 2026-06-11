from pydantic import BaseModel, Field


class ConsignmentInventory(BaseModel):
    consignment_id: str
    distributor: str
    country: str
    material: str
    batch_number: str
    quantity_sent: float
    quantity_reported: float = 0
    quantity_consumed: float = 0
    quantity_remaining: float = 0
    last_report_date: str | None = None
    sent_date: str
    created_by: str | None = None
    updated_at: str | None = None


class CreateConsignmentRequest(BaseModel):
    distributor: str
    country: str
    material: str
    batch_number: str
    quantity_sent: float
    sent_date: str | None = None
    actor: str


class ReportConsignmentRequest(BaseModel):
    quantity_reported: float
    quantity_consumed: float
    report_date: str | None = None
    actor: str


class ConsignmentReconciliation(BaseModel):
    consignment_id: str
    distributor: str
    material: str
    batch_number: str
    quantity_sent: float
    quantity_consumed: float
    expected_remaining: float
    reported_remaining: float
    discrepancy: float
    last_report_date: str | None = None
    reconciled: bool


class ConsignmentRisk(BaseModel):
    consignment_id: str
    distributor: str
    material: str
    batch_number: str
    risk_level: str
    days_since_sent: int
    days_since_report: int | None = None
    consumption_pct: float
    days_to_expiry: int | None = None
    no_report: bool = False
    aging: bool = False
    expiry_exposure: bool = False
    low_consumption: bool = False
    recommended_action: str
    reasons: list[str] = Field(default_factory=list)


class ConsignmentDashboard(BaseModel):
    total_consignments: int = 0
    total_quantity_sent: float = 0
    total_remaining: float = 0
    no_report_count: int = 0
    aging_count: int = 0
    expiry_exposure_count: int = 0
    low_consumption_count: int = 0
    high_risk_count: int = 0
