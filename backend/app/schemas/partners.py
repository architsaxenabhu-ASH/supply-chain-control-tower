from pydantic import BaseModel, Field

from app.schemas.executive import ExecutiveCommandCenterV2


class LogisticsPartnerScorecard(BaseModel):
    partner: str
    shipments_managed: int = 0
    average_transit_days: float | None = None
    delay_pct: float | None = None
    delay_days: float | None = None
    documentation_accuracy_pct: float | None = None
    cost_exposure: float = 0


class CustomsPartnerIntelligence(BaseModel):
    shipments_cleared: int = 0
    average_clearance_days: float | None = None
    delay_pct: float | None = None
    documentation_issues: int = 0
    open_cases: int = 0
    broker_cost_exposure: dict[str, float] = Field(default_factory=dict)


class WarehousePartnerScorecard(BaseModel):
    warehouse: str
    inventory_managed: float = 0
    inventory_accuracy_pct: float | None = None
    inventory_value: float = 0
    cycle_count_variance: float = 0
    open_issues: int = 0


class ExecutiveCommandCenterV3(BaseModel):
    receivables_outstanding: float = 0
    payables_outstanding: float = 0
    net_exposure: float = 0
    logistics_partner_performance: list[LogisticsPartnerScorecard] = Field(default_factory=list)
    customs_partner_performance: CustomsPartnerIntelligence = Field(default_factory=CustomsPartnerIntelligence)
    warehouse_partner_performance: list[WarehousePartnerScorecard] = Field(default_factory=list)
    payment_risk_count: int = 0
    payables_risk_count: int = 0
    partner_risk_count: int = 0
    command_center_v2: ExecutiveCommandCenterV2 = Field(default_factory=ExecutiveCommandCenterV2)
