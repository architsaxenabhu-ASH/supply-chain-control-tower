"""Document Control Tower (Phase 2B, P2).

Operational view of the document pipeline: how many are pending, missing,
corrected, approved; how old they are (aging buckets); and where the
bottlenecks are. Average processing time is approximated by document age
(upload -> now) until the OCR pipeline records true processing timestamps."""

from __future__ import annotations

from datetime import datetime

from app.schemas.operational_intelligence import DocumentAgingBuckets, DocumentControlTower
from app.services.business_intelligence import _candidate_document_ids
from app.services.document_readiness import document_readiness
from app.services.import_repository import list_import_candidates
from app.services.learning_repository import list_field_mapping_history
from app.services.local_document_store import list_saved_documents

APPROVED_IMPORT_STATUSES = {
    "validated",
    "country_documents_pending",
    "customs_in_progress",
    "in_transit",
    "arrived",
    "goods_receipt_pending",
    "received",
    "closed",
}


def _age_days(created_at: str, now: datetime) -> int:
    try:
        created = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        if created.tzinfo is not None:
            created = created.replace(tzinfo=None)
        return max((now - created).days, 0)
    except (ValueError, AttributeError):
        return 0


def _bucket(aging: DocumentAgingBuckets, age: int) -> None:
    if age <= 1:
        aging.days_0_1 += 1
    elif age <= 3:
        aging.days_2_3 += 1
    elif age <= 7:
        aging.days_4_7 += 1
    elif age <= 14:
        aging.days_8_14 += 1
    else:
        aging.days_14_plus += 1


def document_control_tower() -> DocumentControlTower:
    documents = list_saved_documents()
    candidates = list_import_candidates()
    corrections = list_field_mapping_history()
    now = datetime.now()

    corrected_refs = {c.document_reference for c in corrections if c.document_reference}
    approved_doc_ids: set[str] = set()
    for candidate in candidates:
        if candidate.status.value in APPROVED_IMPORT_STATUSES:
            approved_doc_ids |= _candidate_document_ids(candidate)

    aging = DocumentAgingBuckets()
    ages: list[int] = []
    pending = approved = corrected = 0
    for doc in documents:
        age = _age_days(doc.created_at, now)
        ages.append(age)
        _bucket(aging, age)
        if doc.document_id in approved_doc_ids:
            approved += 1
        else:
            pending += 1
        if doc.document_id in corrected_refs or doc.filename in corrected_refs:
            corrected += 1

    missing = sum(len(readiness.missing_documents) for readiness in document_readiness())
    average = round(sum(ages) / len(ages), 1) if ages else None

    bottlenecks: list[str] = []
    if aging.days_14_plus:
        bottlenecks.append(f"{aging.days_14_plus} document(s) older than 14 days")
    if pending:
        bottlenecks.append(f"{pending} document(s) awaiting approval")
    if missing:
        bottlenecks.append(f"{missing} required document(s) missing across shipments")
    if corrected:
        bottlenecks.append(f"{corrected} document(s) needed corrections")

    return DocumentControlTower(
        documents_pending=pending,
        documents_missing=missing,
        documents_corrected=corrected,
        documents_approved=approved,
        average_processing_days=average,
        aging=aging,
        bottlenecks=bottlenecks,
    )
