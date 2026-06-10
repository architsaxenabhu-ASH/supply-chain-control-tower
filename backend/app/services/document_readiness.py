"""Document Readiness Engine (Phase 2B, P1).

For every import shipment, judge how ready its document set is - which of the
core documents are present, how many mandatory fields are still missing, how
many corrections were needed - and roll that into a readiness % and a workflow
status. Import-permit readiness is derived from customs/workflow progress (the
platform does not capture a permit document type yet)."""

from __future__ import annotations

from app.schemas.operational_intelligence import DocumentReadiness
from app.services.business_intelligence import _candidate_document_ids
from app.services.import_repository import list_import_candidates
from app.services.learning_repository import list_field_mapping_history
from app.services.local_document_store import list_saved_documents

REQUIRED_DOCUMENTS = ["Commercial Invoice", "Packing List", "AWB", "Import Permit"]
PERMIT_OBTAINED_STATUSES = {"arrived", "goods_receipt_pending", "received", "closed"}
COMPLETE_STATUSES = {"received", "closed"}
WAREHOUSE_STATUSES = {"arrived", "goods_receipt_pending"}
CUSTOMS_READY_STATUSES = {
    "validated",
    "country_documents_pending",
    "customs_in_progress",
    "in_transit",
    "arrived",
    "goods_receipt_pending",
    "received",
    "closed",
}


def _readiness_for(candidate, documents, correction_refs) -> DocumentReadiness:
    present: list[str] = []
    missing: list[str] = []
    status_value = candidate.status.value

    for label, is_present in (
        ("Commercial Invoice", bool(candidate.commercial_invoice_document_ids)),
        ("Packing List", bool(candidate.packing_list_document_ids)),
        ("AWB", bool(candidate.awb_document_id)),
        ("Import Permit", status_value in PERMIT_OBTAINED_STATUSES),
    ):
        (present if is_present else missing).append(label)

    doc_ids = _candidate_document_ids(candidate)
    missing_fields = sum(documents[d].missing_required_count for d in doc_ids if d in documents)
    completeness = [
        (documents[d].required_field_count - documents[d].missing_required_count) / documents[d].required_field_count
        for d in doc_ids
        if d in documents and documents[d].required_field_count > 0
    ]
    correction_count = sum(1 for ref in correction_refs if ref in doc_ids)

    doc_score = len(present) / len(REQUIRED_DOCUMENTS)
    field_score = sum(completeness) / len(completeness) if completeness else (0.0 if missing_fields else 1.0)
    readiness_pct = round((doc_score * 0.6 + field_score * 0.4) * 100)

    has_core = "Commercial Invoice" in present and "Packing List" in present
    if status_value in COMPLETE_STATUSES:
        status = "Complete"
    elif status_value in WAREHOUSE_STATUSES:
        status = "Ready For Warehouse"
    elif has_core and "AWB" in present and status_value in CUSTOMS_READY_STATUSES:
        status = "Ready For Customs"
    elif has_core:
        status = "Partially Ready"
    else:
        status = "Not Ready"

    return DocumentReadiness(
        import_file_number=candidate.import_file_number,
        shipment_name=candidate.shipment_name,
        destination_country=candidate.destination_country,
        readiness_pct=readiness_pct,
        documents_present=present,
        missing_documents=missing,
        missing_mandatory_fields=missing_fields,
        correction_count=correction_count,
        validation_status=status_value,
        status=status,
    )


def document_readiness() -> list[DocumentReadiness]:
    candidates = list_import_candidates()
    documents = {doc.document_id: doc for doc in list_saved_documents()}
    correction_refs = {c.document_reference for c in list_field_mapping_history() if c.document_reference}
    return [_readiness_for(candidate, documents, correction_refs) for candidate in candidates]
