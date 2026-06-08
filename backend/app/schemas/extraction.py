from enum import Enum

from pydantic import BaseModel, Field


class DocumentType(str, Enum):
    COMMERCIAL_INVOICE = "commercial_invoice"
    PACKING_LIST = "packing_list"
    AIR_WAYBILL = "air_waybill"
    BILL_OF_LADING = "bill_of_lading"
    BILL_OF_ENTRY = "bill_of_entry"


class ValidationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    CORRECTED = "corrected"
    REJECTED = "rejected"


class ExtractedField(BaseModel):
    document_id: str
    field_name: str
    extracted_value: str | None = None
    confidence_score: float | None = Field(default=None, ge=0, le=1)
    corrected_value: str | None = None
    validation_status: ValidationStatus = ValidationStatus.PENDING
    page_number: int | None = None
    bounding_box: dict[str, float] | None = None
    source_engine: str | None = None


class ExtractionSummary(BaseModel):
    document_id: str
    document_type: DocumentType
    fields: list[ExtractedField]
