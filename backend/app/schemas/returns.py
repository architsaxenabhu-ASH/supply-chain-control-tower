from pydantic import BaseModel, Field

RETURN_STATUSES = ["returned", "inspection", "verification", "available", "rejected"]


class ReturnRecord(BaseModel):
    return_id: str
    material: str
    batch_number: str | None = None
    return_reason: str | None = None
    returned_quantity: float
    inspection_result: str | None = None
    verification_result: str | None = None
    reusable_quantity: float = 0
    rejected_quantity: float = 0
    status: str = "returned"
    created_by: str | None = None
    updated_at: str | None = None


class CreateReturnRequest(BaseModel):
    material: str
    batch_number: str | None = None
    return_reason: str | None = None
    returned_quantity: float
    actor: str


class ReturnInspectionRequest(BaseModel):
    inspection_result: str  # pass | partial | fail
    reusable_quantity: float = 0
    rejected_quantity: float = 0
    actor: str


class ReturnVerificationRequest(BaseModel):
    verification_result: str  # pass | fail
    actor: str


class ReturnDashboard(BaseModel):
    total_returns: int = 0
    total_returned_quantity: float = 0
    reusable_quantity: float = 0
    rejected_quantity: float = 0
    available_quantity: float = 0
    pending_inspection: int = 0
    pending_verification: int = 0
    by_reason: dict[str, int] = Field(default_factory=dict)
