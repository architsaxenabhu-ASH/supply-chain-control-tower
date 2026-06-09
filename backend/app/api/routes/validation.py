from fastapi import APIRouter, HTTPException

from app.schemas.validation import FieldCorrectionRequest, FieldCorrectionResponse, ValidationQueueResponse
from app.services.validation_repository import apply_field_correction, list_validation_queue


router = APIRouter()


@router.get("/queue", response_model=ValidationQueueResponse)
def validation_queue() -> ValidationQueueResponse:
    return list_validation_queue()


@router.post("/corrections", response_model=FieldCorrectionResponse)
def correct_field(request: FieldCorrectionRequest) -> FieldCorrectionResponse:
    try:
        return apply_field_correction(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
