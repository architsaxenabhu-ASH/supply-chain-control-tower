from datetime import date
from enum import Enum

from pydantic import BaseModel, Field


class ImportStatus(str, Enum):
    DOCUMENTS_PENDING = "documents_pending"
    UPLOADED = "uploaded"
    EXTRACTED = "extracted"
    VALIDATION_PENDING = "validation_pending"
    VALIDATED = "validated"
    COUNTRY_DOCUMENTS_PENDING = "country_documents_pending"
    CUSTOMS_IN_PROGRESS = "customs_in_progress"
    IN_TRANSIT = "in_transit"
    ARRIVED = "arrived"
    GOODS_RECEIPT_PENDING = "goods_receipt_pending"
    RECEIVED = "received"
    CLOSED = "closed"


class ImportLineCandidate(BaseModel):
    item_code: str
    product_description: str
    batch_number: str
    expiry_date: date | None = None
    quantity: float
    uom: str
    unit_value: float | None = None
    currency: str | None = None
    product_profile_status: str


class ImportFileCandidate(BaseModel):
    import_file_number: str
    supplier_name: str | None = None
    destination_entity: str
    destination_country: str
    status: ImportStatus
    invoice_number: str | None = None
    invoice_date: date | None = None
    awb_number: str | None = None
    origin_country: str | None = None
    carrier_name: str | None = None
    flight_number: str | None = None
    flight_date: date | None = None
    package_count: int | None = None
    gross_weight_kg: float | None = None
    chargeable_weight_kg: float | None = None
    lines: list[ImportLineCandidate]
    source_document_ids: list[str] = Field(default_factory=list)
    extraction_warnings: list[str] = Field(default_factory=list)


class ImportAssemblyRequest(BaseModel):
    commercial_invoice_document_id: str
    packing_list_document_id: str
    awb_document_id: str | None = None


class ImportApprovalRequest(BaseModel):
    candidate: ImportFileCandidate
    approved_by: str
    auth_token: str
    approval_note: str | None = None


class ImportGoodsReceiptPostRequest(BaseModel):
    candidate: ImportFileCandidate
    warehouse_name: str
    posted_by: str
    auth_token: str
    supplier_name: str | None = None
