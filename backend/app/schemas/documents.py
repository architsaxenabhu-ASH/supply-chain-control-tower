from pydantic import BaseModel

from app.schemas.extraction import DocumentType, ExtractedField
from app.schemas.master_candidates import MasterCandidate
from app.schemas.validation_rules import RequiredFieldCheck


class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    document_type: DocumentType
    status: str
    saved_path: str
    extraction_master_path: str
    master_candidates_path: str
    extracted_field_count: int
    master_candidate_count: int
    required_field_count: int
    missing_required_count: int


class DocumentRecord(BaseModel):
    document_id: str
    filename: str
    document_type: DocumentType
    status: str
    saved_path: str
    extraction_master_path: str
    master_candidates_path: str
    extracted_field_count: int
    master_candidate_count: int
    required_field_count: int
    missing_required_count: int
    created_at: str


class DocumentExtractionMaster(BaseModel):
    document: DocumentRecord
    fields: list[ExtractedField]
    master_candidates: list[MasterCandidate] = []
    required_field_checks: list[RequiredFieldCheck] = []
