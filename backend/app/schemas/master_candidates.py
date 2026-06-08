from enum import Enum

from pydantic import BaseModel


class MasterCandidateType(str, Enum):
    SUPPLIER = "supplier"
    CUSTOMER = "customer"
    PRODUCT = "product"
    CARRIER = "carrier"
    UOM = "uom"
    CURRENCY = "currency"
    COUNTRY = "country"


class MasterCandidate(BaseModel):
    document_id: str
    candidate_type: MasterCandidateType
    candidate_name: str
    candidate_code: str | None = None
    source_fields: dict[str, str]
    status: str = "pending_validation"

