from pydantic import BaseModel, Field

TARGET_SCOPES = ["country", "vertical", "distributor", "customer"]


class CommercialTarget(BaseModel):
    scope: str
    scope_value: str
    target_value: float = 0
    target_quantity: float = 0
    period: str | None = None
    updated_by: str | None = None
    updated_at: str | None = None


class SetTargetRequest(BaseModel):
    scope: str
    scope_value: str
    target_value: float = 0
    target_quantity: float = 0
    period: str | None = None
    actor: str


class PerformanceScorecard(BaseModel):
    scope: str
    name: str
    target_value: float = 0
    actual_value: float = 0
    value_achievement_pct: float | None = None
    target_quantity: float = 0
    actual_quantity: float = 0
    quantity_achievement_pct: float | None = None
    growth_pct: float | None = None
    diagnostics: dict[str, str] = Field(default_factory=dict)
