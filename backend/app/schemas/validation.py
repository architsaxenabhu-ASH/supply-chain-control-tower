from pydantic import BaseModel, Field

from app.schemas.extraction import DocumentType, ValidationStatus


class ValidationQueueItem(BaseModel):
    queue_id: str
    document_id: str
    filename: str
    document_type: DocumentType
    field_name: str
    extracted_value: str | None = None
    corrected_value: str | None = None
    effective_value: str | None = None
    confidence_score: float | None = None
    validation_status: ValidationStatus
    issue_type: str
    issue_label: str
    required_group: str | None = None
    source_engine: str | None = None
    created_at: str


class ValidationQueueResponse(BaseModel):
    items: list[ValidationQueueItem]
    total_count: int
    missing_required_count: int
    pending_review_count: int
    corrected_count: int


class FieldCorrectionRequest(BaseModel):
    document_id: str
    field_name: str
    corrected_value: str
    correction_reason: str = Field(min_length=3)
    corrected_by: str
    auth_token: str


class FieldCorrectionResponse(BaseModel):
    item: ValidationQueueItem
    message: str
