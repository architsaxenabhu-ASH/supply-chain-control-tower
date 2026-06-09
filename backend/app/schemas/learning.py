from enum import Enum
from datetime import datetime

from pydantic import BaseModel, Field


class EntityType(str, Enum):
    PRODUCT = "product"
    CUSTOMER = "customer"
    SUPPLIER = "supplier"
    CARRIER = "carrier"
    COUNTRY = "country"
    UOM = "uom"


class LearningRule(BaseModel):
    document_type: str
    source_text: str
    target_field: str
    corrected_value: str | None = None
    confidence: float = 50
    success_count: int = 0
    failure_count: int = 0


class CorrectionEventRequest(BaseModel):
    document_type: str
    field_name: str
    original_value: str | None = None
    corrected_value: str | None = None
    correction_reason: str | None = None
    corrected_by: str
    document_reference: str | None = None


class EntityAliasRequest(BaseModel):
    entity_type: EntityType
    alias_text: str
    master_code: str
    approved: bool = True


class ProductLearningProfile(BaseModel):
    item_code: str
    product_description: str | None = None
    product_category: str | None = None
    uom: str | None = None
    shelf_life_months: int | None = None
    batch_tracking_required: bool | None = None
    serial_tracking_required: bool | None = None
    expiry_tracking_required: bool | None = None
    storage_condition: str | None = None
    temperature_requirement: str | None = None
    regulatory_classification: str | None = None
    hs_code: str | None = None
    default_currency: str | None = None
    profile_status: str = "incomplete"
    free_text_answers: dict[str, str] = Field(default_factory=dict)
    created_by: str | None = None
    created_at: datetime | None = None
    updated_by: str | None = None
    updated_at: datetime | None = None


class ProductProfileQuestion(BaseModel):
    field_name: str
    question: str
    reason: str


class ProductLearningProfileResponse(BaseModel):
    item_code: str
    is_known: bool
    profile: ProductLearningProfile | None = None
    questions: list[ProductProfileQuestion]


class ProductProfileFreeTextSaveRequest(BaseModel):
    item_code: str
    answered_by: str
    answers: dict[str, str]


class ProductProfileEditRequest(BaseModel):
    item_code: str
    field_name: str
    old_value: str | None = None
    new_value: str
    edit_reason: str
    edited_by: str


class ProductProfileEditEvent(BaseModel):
    item_code: str
    field_name: str
    old_value: str | None = None
    new_value: str
    edit_reason: str
    edited_by: str
    edited_at: datetime


class CountryDocumentRequirementRule(BaseModel):
    country: str
    vertical: str
    material_code: str
    required_document_type: str
    approved_by: str | None = None
    confidence: float = 50
    success_count: int = 0
    failure_count: int = 0
    created_at: datetime = Field(default_factory=datetime.now)


class CountryDocumentRequirementRequest(BaseModel):
    country: str
    vertical: str
    material_code: str
    required_document_type: str
    approved_by: str


class WarehouseCandidateRequest(BaseModel):
    country: str
    warehouse_name: str
    created_from_import_file: str | None = None
    created_by: str


class WarehouseCandidate(BaseModel):
    country: str
    warehouse_name: str
    created_from_import_file: str | None = None
    status: str = "pending_validation"
    created_by: str
    created_at: datetime = Field(default_factory=datetime.now)


class LearningStat(BaseModel):
    """A simple label/count pair used for the Learning Center charts."""

    label: str
    count: int


class CorrectionSuggestion(BaseModel):
    """A value the platform suggests because it learned it from past corrections."""

    suggested_value: str
    confidence: float
    times_seen: int
    based_on: str


class CorrectionSuggestionResponse(BaseModel):
    field_name: str
    current_value: str | None = None
    suggestion: CorrectionSuggestion | None = None


class ImportChecklistItem(BaseModel):
    required_document_type: str
    confidence: float
    success_count: int
    present: bool


class ImportChecklistRequest(BaseModel):
    country: str
    vertical: str
    material_code: str
    present_document_types: list[str] = Field(default_factory=list)


class ImportChecklistResponse(BaseModel):
    country: str
    vertical: str
    material_code: str
    is_known: bool = False
    items: list[ImportChecklistItem] = Field(default_factory=list)
    required_count: int = 0
    present_count: int = 0
    missing_count: int = 0


class LearningInsights(BaseModel):
    """Aggregated view of everything the platform has learned so far."""

    total_learning_rules: int = 0
    total_corrections: int = 0
    total_product_profiles: int = 0
    total_country_document_rules: int = 0
    total_entity_aliases: int = 0
    total_warehouse_candidates: int = 0
    average_rule_confidence: float = 0
    top_corrected_fields: list[LearningStat] = Field(default_factory=list)
    corrections_by_document_type: list[LearningStat] = Field(default_factory=list)
    top_learned_rules: list[LearningRule] = Field(default_factory=list)
    country_document_rules: list[CountryDocumentRequirementRule] = Field(default_factory=list)
    recent_corrections: list[CorrectionEventRequest] = Field(default_factory=list)
