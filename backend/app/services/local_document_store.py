from __future__ import annotations

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile

from app.schemas.documents import DocumentRecord
from app.schemas.extraction import DocumentType, ExtractedField, ValidationStatus
from app.services.document_field_catalog import get_fields_for_document_type
from app.services.master_candidate_generator import generate_master_candidates
from app.services.required_field_rules import check_required_fields
from app.services.simple_extraction import extract_fields_from_file


PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_ROOT = PROJECT_ROOT / "data"
UPLOAD_ROOT = DATA_ROOT / "uploads"
EXTRACTION_ROOT = DATA_ROOT / "extraction_masters"
MASTER_CANDIDATE_ROOT = DATA_ROOT / "master_candidates"
DOCUMENT_INDEX_PATH = DATA_ROOT / "documents.json"

ALLOWED_EXTENSIONS = {".pdf", ".xlsx", ".xls", ".csv", ".jpg", ".jpeg", ".png"}


def ensure_storage_dirs() -> None:
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    EXTRACTION_ROOT.mkdir(parents=True, exist_ok=True)
    MASTER_CANDIDATE_ROOT.mkdir(parents=True, exist_ok=True)
    DATA_ROOT.mkdir(parents=True, exist_ok=True)
    if not DOCUMENT_INDEX_PATH.exists():
        DOCUMENT_INDEX_PATH.write_text("[]", encoding="utf-8")


def sanitize_filename(filename: str) -> str:
    clean_name = re.sub(r"[^A-Za-z0-9_.-]+", "_", filename).strip("._")
    return clean_name or "uploaded_document"


def load_document_index() -> list[dict[str, object]]:
    ensure_storage_dirs()
    return json.loads(DOCUMENT_INDEX_PATH.read_text(encoding="utf-8"))


def save_document_index(records: list[dict[str, object]]) -> None:
    ensure_storage_dirs()
    DOCUMENT_INDEX_PATH.write_text(json.dumps(records, indent=2), encoding="utf-8")


def write_extraction_artifacts(
    document_id: str,
    document_type: DocumentType,
    filename: str,
    saved_path: Path,
    extraction_master_path: Path,
    master_candidates_path: Path,
) -> tuple[list[ExtractedField], list[object], list[object]]:
    expected_fields = get_fields_for_document_type(document_type)
    extracted_fields = extract_fields_from_file(
        document_id=document_id,
        file_path=saved_path,
        document_type=document_type,
        expected_fields=expected_fields,
    )

    extraction_master_path.write_text(
        json.dumps(
            {
                "document_id": document_id,
                "document_type": document_type.value,
                "filename": filename,
                "fields": [field.model_dump(mode="json") for field in extracted_fields],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    master_candidates = generate_master_candidates(
        document_id=document_id,
        extracted_fields=extracted_fields,
    )
    master_candidates_path.write_text(
        json.dumps(
            {
                "document_id": document_id,
                "document_type": document_type.value,
                "candidates": [candidate.model_dump(mode="json") for candidate in master_candidates],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    required_field_checks = check_required_fields(
        document_type=document_type,
        extracted_fields=extracted_fields,
    )
    return extracted_fields, master_candidates, required_field_checks


async def save_uploaded_document(file: UploadFile, document_type: DocumentType) -> DocumentRecord:
    ensure_storage_dirs()

    original_filename = sanitize_filename(file.filename or "uploaded_document")
    extension = Path(original_filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValueError(f"Unsupported file type '{extension}'. Allowed types: {allowed}")

    document_id = f"DOC-{datetime.now(UTC).strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"
    saved_filename = f"{document_id}_{original_filename}"
    saved_path = UPLOAD_ROOT / saved_filename

    content = await file.read()
    saved_path.write_bytes(content)

    extraction_master_path = EXTRACTION_ROOT / f"{document_id}_master.json"
    master_candidates_path = MASTER_CANDIDATE_ROOT / f"{document_id}_candidates.json"
    extracted_fields, master_candidates, required_field_checks = write_extraction_artifacts(
        document_id=document_id,
        document_type=document_type,
        filename=original_filename,
        saved_path=saved_path,
        extraction_master_path=extraction_master_path,
        master_candidates_path=master_candidates_path,
    )
    missing_required_count = sum(
        1 for check in required_field_checks if not check.is_satisfied
    )

    record = DocumentRecord(
        document_id=document_id,
        filename=original_filename,
        document_type=document_type,
        status="extraction_master_generated",
        saved_path=str(saved_path),
        extraction_master_path=str(extraction_master_path),
        master_candidates_path=str(master_candidates_path),
        extracted_field_count=len(extracted_fields),
        master_candidate_count=len(master_candidates),
        required_field_count=len(required_field_checks),
        missing_required_count=missing_required_count,
        created_at=datetime.now(UTC).isoformat(),
    )

    records = load_document_index()
    records.append(record.model_dump(mode="json"))
    save_document_index(records)

    return record


def rescan_saved_document(document_id: str) -> DocumentRecord:
    record = get_saved_document(document_id)
    if record is None:
        raise ValueError(f"Document not found: {document_id}")

    saved_path = Path(record.saved_path)
    if not saved_path.exists():
        raise ValueError(f"Saved file is missing for {document_id}")

    extracted_fields, master_candidates, required_field_checks = write_extraction_artifacts(
        document_id=record.document_id,
        document_type=record.document_type,
        filename=record.filename,
        saved_path=saved_path,
        extraction_master_path=Path(record.extraction_master_path),
        master_candidates_path=Path(record.master_candidates_path),
    )
    missing_required_count = sum(
        1 for check in required_field_checks if not check.is_satisfied
    )
    updated_record = record.model_copy(
        update={
            "status": "extraction_master_generated",
            "extracted_field_count": len(extracted_fields),
            "master_candidate_count": len(master_candidates),
            "required_field_count": len(required_field_checks),
            "missing_required_count": missing_required_count,
        }
    )
    records = [
        updated_record.model_dump(mode="json")
        if saved_record.get("document_id") == document_id
        else saved_record
        for saved_record in load_document_index()
    ]
    save_document_index(records)
    return updated_record


def list_saved_documents() -> list[DocumentRecord]:
    return [DocumentRecord(**record) for record in load_document_index()]


def get_saved_document(document_id: str) -> DocumentRecord | None:
    for record in list_saved_documents():
        if record.document_id == document_id:
            return record
    return None


def get_extraction_master(document_id: str) -> dict[str, object] | None:
    ensure_storage_dirs()
    path = EXTRACTION_ROOT / f"{document_id}_master.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def get_master_candidates(document_id: str) -> list[dict[str, object]]:
    ensure_storage_dirs()
    path = MASTER_CANDIDATE_ROOT / f"{document_id}_candidates.json"
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    return payload.get("candidates", [])


def update_extracted_field_correction(
    *,
    document_id: str,
    field_name: str,
    corrected_value: str,
) -> tuple[DocumentRecord, ExtractedField, str | None]:
    record = get_saved_document(document_id)
    if record is None:
        raise ValueError(f"Document not found: {document_id}")

    master = get_extraction_master(document_id)
    if master is None:
        raise ValueError(f"Extraction master not found: {document_id}")

    fields = [ExtractedField(**field) for field in master.get("fields", [])]
    matching_field = next((field for field in fields if field.field_name == field_name), None)
    if matching_field is None:
        matching_field = ExtractedField(
            document_id=document_id,
            field_name=field_name,
            validation_status=ValidationStatus.PENDING,
            source_engine="manual_validation",
        )
        fields.append(matching_field)

    old_value = matching_field.corrected_value or matching_field.extracted_value
    matching_field.corrected_value = corrected_value.strip()
    matching_field.validation_status = ValidationStatus.CORRECTED
    matching_field.confidence_score = 1
    matching_field.source_engine = "human_validation"

    extraction_master_path = Path(record.extraction_master_path)
    extraction_master_path.write_text(
        json.dumps(
            {
                **master,
                "fields": [field.model_dump(mode="json") for field in fields],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    master_candidates = generate_master_candidates(
        document_id=document_id,
        extracted_fields=fields,
    )
    master_candidates_path = Path(record.master_candidates_path)
    master_candidates_path.write_text(
        json.dumps(
            {
                "document_id": document_id,
                "document_type": record.document_type.value,
                "candidates": [candidate.model_dump(mode="json") for candidate in master_candidates],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    required_field_checks = check_required_fields(
        document_type=record.document_type,
        extracted_fields=fields,
    )
    missing_required_count = sum(
        1 for check in required_field_checks if not check.is_satisfied
    )
    updated_record = record.model_copy(
        update={
            "master_candidate_count": len(master_candidates),
            "required_field_count": len(required_field_checks),
            "missing_required_count": missing_required_count,
        }
    )
    records = [
        updated_record.model_dump(mode="json")
        if saved_record.get("document_id") == document_id
        else saved_record
        for saved_record in load_document_index()
    ]
    save_document_index(records)
    return updated_record, matching_field, old_value
