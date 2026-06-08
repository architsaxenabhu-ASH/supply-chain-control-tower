from fastapi import APIRouter, HTTPException

from app.schemas.warehouse import CreateShipmentRequest, ShipmentApprovalRequest, ShipmentRequest, WorkflowResult
from app.services.warehouse_repository import approve_shipment, create_shipment_request, list_shipments


router = APIRouter()


@router.get("", response_model=list[ShipmentRequest])
def shipments() -> list[ShipmentRequest]:
    return list_shipments()


@router.post("", response_model=ShipmentRequest)
def create(request: CreateShipmentRequest) -> ShipmentRequest:
    try:
        return create_shipment_request(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/{shipment_id}/approve", response_model=WorkflowResult)
def approve(shipment_id: str, request: ShipmentApprovalRequest) -> WorkflowResult:
    try:
        return approve_shipment(shipment_id=shipment_id, request=request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
