from pydantic import BaseModel, Field


class SupplierIntelligence(BaseModel):
    supplier: str
    shipment_count: int = 0
    on_time_pct: float | None = None
    average_lead_time_days: float | None = None
    delay_count: int = 0
    document_accuracy_pct: float | None = None


class CarrierIntelligence(BaseModel):
    carrier: str
    shipment_count: int = 0
    average_transit_days: float | None = None
    delay_days: float | None = None
    on_time_pct: float | None = None


class ProductMixEntry(BaseModel):
    item_code: str
    quantity: float


class CustomerIntelligence(BaseModel):
    customer: str
    shipment_count: int = 0
    orders_per_month: float | None = None
    product_mix: list[ProductMixEntry] = Field(default_factory=list)
    fill_rate_pct: float | None = None
    delivery_performance_pct: float | None = None


class DocumentIntelligence(BaseModel):
    document_id: str
    filename: str
    document_type: str
    supplier: str | None = None
    country: str | None = None
    template_match: bool = False
    template_id: str | None = None
    ocr_confidence_pct: float | None = None
    processing_time_ms: float | None = None
    correction_count: int = 0


class RelationshipNode(BaseModel):
    entity_type: str
    id: str
    label: str | None = None


class RelationshipMap(BaseModel):
    root: RelationshipNode
    related: dict[str, list[RelationshipNode]] = Field(default_factory=dict)
