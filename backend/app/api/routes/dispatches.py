from fastapi import APIRouter, HTTPException

from app.schemas.warehouse import CreateDispatchRequest, Dispatch, WorkflowResult
from app.services.warehouse_repository import confirm_dispatch, list_dispatches


router = APIRouter()


@router.get("", response_model=list[Dispatch])
def dispatches() -> list[Dispatch]:
    return list_dispatches()


@router.post("/{shipment_id}/confirm", response_model=WorkflowResult)
def confirm(shipment_id: str, request: CreateDispatchRequest) -> WorkflowResult:
    try:
        return confirm_dispatch(shipment_id=shipment_id, request=request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
