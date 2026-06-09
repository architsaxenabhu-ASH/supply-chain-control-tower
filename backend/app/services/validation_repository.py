from datetime import UTC, datetime

from app.db.local_persistence import record_audit_event
from app.schemas.extraction import ExtractedField, ValidationStatus
from app.schemas.learning import CorrectionEventRequest
from app.schemas.validation import FieldCorrectionRequest, FieldCorrectionResponse, ValidationQueueItem, ValidationQueueResponse
from app.services.learning_repository import record_correction
from app.services.local_document_store import (
    get_extraction_master,
    get_saved_document,
    list_saved_documents,
    update_extracted_field_correction,
)
from app.services.required_field_rules import check_required_fields
from app.services.security_repository import authenticate_token, normalize_email, permissions_for_role


def list_validation_queue() -> ValidationQueueResponse:
    items: list[ValidationQueueItem] = []
    for document in list_saved_documents():
        master = get_extraction_master(document.document_id)
        if not master:
            continue
        fields = [ExtractedField(**field) for field in master.get("fields", [])]
        fields_by_name = {field.field_name: field for field in fields}

        for check in check_required_fields(document.document_type, fields):
            if check.is_satisfied:
                continue
            field_name = next(
                (candidate for candidate in check.accepted_fields if candidate in fields_by_name),
                check.accepted_fields[0],
            )
            field = fields_by_name.get(field_name)
            items.append(
                build_queue_item(
                    document_id=document.document_id,
                    filename=document.filename,
                    document_type=document.document_type,
                    created_at=document.created_at,
                    field=field,
                    field_name=field_name,
                    issue_type="missing_required",
                    issue_label=f"Missing required: {check.requirement_name}",
                    required_group=check.requirement_name,
                )
            )

        for field in fields:
            if not field.extracted_value and not field.corrected_value:
                continue
            issue_type = issue_type_for_field(field)
            items.append(
                build_queue_item(
                    document_id=document.document_id,
                    filename=document.filename,
                    document_type=document.document_type,
                    created_at=document.created_at,
                    field=field,
                    field_name=field.field_name,
                    issue_type=issue_type,
                    issue_label=issue_label_for_field(field, issue_type),
                )
            )

    sorted_items = sorted(
        dedupe_queue_items(items),
        key=lambda item: (
            issue_priority(item.issue_type),
            item.document_type.value,
            item.filename,
            item.field_name,
        ),
    )
    return ValidationQueueResponse(
        items=sorted_items,
        total_count=len(sorted_items),
        missing_required_count=sum(1 for item in sorted_items if item.issue_type == "missing_required"),
        pending_review_count=sum(1 for item in sorted_items if item.issue_type in {"pending_review", "low_confidence"}),
        corrected_count=sum(1 for item in sorted_items if item.issue_type == "corrected"),
    )


def apply_field_correction(request: FieldCorrectionRequest) -> FieldCorrectionResponse:
    if not request.corrected_value.strip():
        raise ValueError("Corrected value is mandatory.")
    if not request.correction_reason.strip():
        raise ValueError("Correction reason is mandatory.")

    user = authenticate_token(request.auth_token)
    permissions = set(permissions_for_role(user.role_name))
    if not permissions.intersection({"import_approval", "goods_receipt", "security"}):
        raise ValueError(f"{user.role_name} is not allowed to validate extracted document fields.")
    if normalize_email(request.corrected_by) != user.email:
        raise ValueError("Correction user must match the logged-in user.")

    document = get_saved_document(request.document_id)
    if document is None:
        raise ValueError(f"Document not found: {request.document_id}")

    updated_document, corrected_field, old_value = update_extracted_field_correction(
        document_id=request.document_id,
        field_name=request.field_name,
        corrected_value=request.corrected_value,
    )
    event = CorrectionEventRequest(
        document_type=updated_document.document_type.value,
        field_name=request.field_name,
        original_value=old_value,
        corrected_value=request.corrected_value.strip(),
        correction_reason=request.correction_reason.strip(),
        corrected_by=user.email,
        document_reference=request.document_id,
    )
    record_correction(event)
    record_audit_event(
        action="field_correction",
        module_name="validation",
        entity_name="document_field",
        entity_id=f"{request.document_id}:{request.field_name}",
        actor=user.email,
        reason=request.correction_reason.strip(),
        old_value={request.field_name: old_value},
        new_value={request.field_name: request.corrected_value.strip()},
    )

    return FieldCorrectionResponse(
        item=build_queue_item(
            document_id=updated_document.document_id,
            filename=updated_document.filename,
            document_type=updated_document.document_type,
            created_at=updated_document.created_at,
            field=corrected_field,
            field_name=corrected_field.field_name,
            issue_type="corrected",
            issue_label="Corrected by validator",
        ),
        message=f"{request.field_name} corrected and learning memory updated.",
    )


def build_queue_item(
    *,
    document_id: str,
    filename: str,
    document_type,
    created_at: str,
    field: ExtractedField | None,
    field_name: str,
    issue_type: str,
    issue_label: str,
    required_group: str | None = None,
) -> ValidationQueueItem:
    extracted_value = field.extracted_value if field else None
    corrected_value = field.corrected_value if field else None
    validation_status = field.validation_status if field else ValidationStatus.PENDING
    return ValidationQueueItem(
        queue_id=f"{document_id}:{field_name}",
        document_id=document_id,
        filename=filename,
        document_type=document_type,
        field_name=field_name,
        extracted_value=extracted_value,
        corrected_value=corrected_value,
        effective_value=corrected_value or extracted_value,
        confidence_score=field.confidence_score if field else None,
        validation_status=validation_status,
        issue_type=issue_type,
        issue_label=issue_label,
        required_group=required_group,
        source_engine=field.source_engine if field else None,
        created_at=created_at or datetime.now(UTC).isoformat(),
    )


def issue_type_for_field(field: ExtractedField) -> str:
    if field.validation_status == ValidationStatus.CORRECTED:
        return "corrected"
    if field.confidence_score is not None and field.confidence_score < 0.75:
        return "low_confidence"
    return "pending_review"


def issue_label_for_field(field: ExtractedField, issue_type: str) -> str:
    if issue_type == "corrected":
        return "Corrected by validator"
    if issue_type == "low_confidence":
        return "Low confidence, review carefully"
    if field.source_engine == "human_validation":
        return "Human validated"
    return "Pending validator review"


def dedupe_queue_items(items: list[ValidationQueueItem]) -> list[ValidationQueueItem]:
    best_by_id: dict[str, ValidationQueueItem] = {}
    for item in items:
        existing = best_by_id.get(item.queue_id)
        if existing is None or issue_priority(item.issue_type) < issue_priority(existing.issue_type):
            best_by_id[item.queue_id] = item
    return list(best_by_id.values())


def issue_priority(issue_type: str) -> int:
    priorities = {
        "missing_required": 0,
        "low_confidence": 1,
        "pending_review": 2,
        "corrected": 3,
    }
    return priorities.get(issue_type, 9)
