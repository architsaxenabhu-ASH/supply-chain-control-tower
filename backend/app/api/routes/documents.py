from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.schemas.documents import DocumentExtractionMaster, DocumentRecord, DocumentUploadResponse
from app.schemas.extraction import DocumentType, ExtractedField
from app.services.local_document_store import (
    get_extraction_master,
    get_master_candidates,
    list_saved_documents,
    save_uploaded_document,
)
from app.services.required_field_rules import check_required_fields
from app.services.document_field_catalog import get_fields_for_document_type


router = APIRouter()


@router.post("/upload", response_model=DocumentUploadResponse)
async def upload_document(
    document_type: DocumentType = Form(...),
    file: UploadFile = File(...),
) -> DocumentUploadResponse:
    try:
        record = await save_uploaded_document(file=file, document_type=document_type)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

    return DocumentUploadResponse(**record.model_dump())


@router.get("", response_model=list[DocumentRecord])
def documents() -> list[DocumentRecord]:
    return list_saved_documents()


@router.get("/{document_id}/extraction-master", response_model=DocumentExtractionMaster)
def extraction_master(document_id: str) -> dict[str, object]:
    master = get_extraction_master(document_id)
    if master is None:
        raise HTTPException(status_code=404, detail="Extraction master not found")

    matching_documents = [
        document for document in list_saved_documents() if document.document_id == document_id
    ]
    if not matching_documents:
        raise HTTPException(status_code=404, detail="Document not found")

    fields = [ExtractedField(**field) for field in master["fields"]]

    return {
        "document": matching_documents[0],
        "fields": fields,
        "master_candidates": get_master_candidates(document_id),
        "required_field_checks": check_required_fields(
            document_type=matching_documents[0].document_type,
            extracted_fields=fields,
        ),
    }


@router.get("/field-catalog/{document_type}")
def document_field_catalog(document_type: DocumentType) -> dict[str, list[str]]:
    return {"fields": get_fields_for_document_type(document_type)}
