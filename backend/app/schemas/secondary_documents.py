from pydantic import BaseModel, Field


# Secondary Sales document bundle (Phase 6F). Mirrors the inbound import
# candidate for the outbound flow (subsidiary → customer). A bundle is uploaded,
# sits Pending Validation, and only becomes an official secondary shipment once
# a validator approves it. Nothing here touches inventory or business metrics
# until validated.


class SecondaryDocumentRow(BaseModel):
    label: str
    value: str


class SecondaryDocument(BaseModel):
    document_id: str
    filename: str
    kind: str  # business label: customer_po / invoice / packing_list / pod / other
    rows: list[SecondaryDocumentRow] = Field(default_factory=list)


class SecondaryShipment(BaseModel):
    shipment_id: str
    customer: str
    country: str
    order_number: str
    shipment_type: str = "standard"
    status: str = "pending_validation"  # pending_validation | validated | rejected | deleted
    documents: list[SecondaryDocument] = Field(default_factory=list)
    uploaded_by: str | None = None
    uploaded_at: str
    validated_by: str | None = None
    validated_at: str | None = None
    note: str | None = None
    # Soft delete — the record is never removed, only marked, for the audit trail.
    deleted_by: str | None = None
    deleted_at: str | None = None
    delete_reason: str | None = None


class SaveSecondaryShipmentRequest(BaseModel):
    customer: str
    country: str
    order_number: str
    shipment_type: str = "standard"
    documents: list[SecondaryDocument] = Field(default_factory=list)
    actor: str | None = None


class DecideSecondaryShipmentRequest(BaseModel):
    actor: str | None = None
    note: str | None = None
