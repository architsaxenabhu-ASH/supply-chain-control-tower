from fastapi import APIRouter, HTTPException

from app.schemas.warehouse import ShipmentApprovalRequest, ShipmentRequest, WorkflowResult
from app.services.warehouse_repository import approve_shipment, list_shipments


router = APIRouter()


@router.get("", response_model=list[ShipmentRequest])
def shipments() -> list[ShipmentRequest]:
    return list_shipments()


@router.post("/{shipment_id}/approve", response_model=WorkflowResult)
def approve(shipment_id: str, request: ShipmentApprovalRequest) -> WorkflowResult:
    try:
        return approve_shipment(shipment_id=shipment_id, request=request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
