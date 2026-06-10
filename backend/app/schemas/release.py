from pydantic import BaseModel

RELEASE_STAGES = [
    "In Transit",
    "Customs Clearance",
    "Import Permit Obtained",
    "Inland Transit",
    "Warehouse Receipt",
    "Batch Verification",
    "Approval Pending",
    "Available For Sale",
]


class ReleaseRecord(BaseModel):
    item_code: str
    batch_number: str
    status: str = "In Transit"
    batch_verified: bool = False
    approved: bool = False
    sellable: bool = False
    warehouse: str | None = None
    updated_by: str | None = None
    updated_at: str | None = None


class ReleaseAdvanceRequest(BaseModel):
    item_code: str
    batch_number: str
    status: str | None = None
    batch_verified: bool | None = None
    approved: bool | None = None
    warehouse: str | None = None
    actor: str


class NotSellableBatch(BaseModel):
    item_code: str
    batch_number: str
    warehouse: str
    quantity: float
    status: str
    reason: str
