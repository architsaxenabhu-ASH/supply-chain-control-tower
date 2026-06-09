from fastapi import APIRouter, HTTPException

from app.schemas.erp import ErpTemplate, ErpUploadPreview, ErpUploadPreviewRequest
from app.services.erp_repository import list_erp_templates, preview_erp_upload


router = APIRouter()


@router.get("/templates", response_model=list[ErpTemplate])
def templates() -> list[ErpTemplate]:
    return list_erp_templates()


@router.post("/preview", response_model=ErpUploadPreview)
def preview(request: ErpUploadPreviewRequest) -> ErpUploadPreview:
    try:
        return preview_erp_upload(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
