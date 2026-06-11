from pydantic import BaseModel, Field

# Decision taxonomy (Phase 4 P5). Workflow categories, not business master data.
DECISION_OWNERS = ["sales", "supply_chain", "finance", "management"]
DECISION_PROBLEM_TYPES = [
    "commitment_risk",
    "expiry_risk",
    "payment_risk",
    "consignment_risk",
    "shipment_delay",
    "country_performance",
    "vertical_performance",
    "distributor_performance",
]


class DecisionRequest(BaseModel):
    decision_type: str
    reason: str
    user: str
    role: str | None = None
    problem_type: str | None = None
    owner: str | None = None
    context: str | None = None
    options_considered: list[str] = Field(default_factory=list)
    related_product: str | None = None
    related_batch: str | None = None
    related_shipment: str | None = None
    related_customer: str | None = None
    related_supplier: str | None = None
    expected_outcome: str | None = None
    status: str = "open"


class DecisionOutcomeRequest(BaseModel):
    actual_outcome: str | None = None
    effectiveness: str | None = None  # effective | partially_effective | ineffective
    status: str
    actor: str


class Decision(BaseModel):
    decision_id: str
    decision_type: str
    reason: str
    user: str
    role: str | None = None
    problem_type: str | None = None
    owner: str | None = None
    context: str | None = None
    options_considered: list[str] = Field(default_factory=list)
    decided_at: str
    related_product: str | None = None
    related_batch: str | None = None
    related_shipment: str | None = None
    related_customer: str | None = None
    related_supplier: str | None = None
    expected_outcome: str | None = None
    actual_outcome: str | None = None
    effectiveness: str | None = None
    status: str = "open"


# --- P5 read models -----------------------------------------------------

class DecisionEffectiveness(BaseModel):
    decision_id: str
    decision_type: str
    problem_type: str | None = None
    owner: str | None = None
    expected_outcome: str | None = None
    actual_outcome: str | None = None
    effectiveness: str | None = None
    status: str


class SimilarDecision(BaseModel):
    decision_id: str
    decision_type: str
    problem_type: str | None = None
    owner: str | None = None
    reason: str
    expected_outcome: str | None = None
    actual_outcome: str | None = None
    effectiveness: str | None = None
    similarity_score: int
    matched_on: list[str] = Field(default_factory=list)


# --- P7 learning foundation ---------------------------------------------

class LearningPattern(BaseModel):
    key: str
    count: int
    effective: int
    success_rate_pct: float | None = None


class DecisionLearningInsights(BaseModel):
    total_decisions: int = 0
    decisions_with_outcome: int = 0
    overall_success_rate_pct: float | None = None
    most_common_decisions: list[LearningPattern] = Field(default_factory=list)
    most_successful_decisions: list[LearningPattern] = Field(default_factory=list)
    by_owner: list[LearningPattern] = Field(default_factory=list)
    by_problem_type: list[LearningPattern] = Field(default_factory=list)
