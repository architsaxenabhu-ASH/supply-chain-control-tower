from fastapi import APIRouter, HTTPException

from app.schemas.secondary_documents import (
    DecideSecondaryShipmentRequest,
    SaveSecondaryShipmentRequest,
    SecondaryShipment,
)
from app.services.secondary_documents_repository import (
    approve_secondary_shipment,
    list_secondary_shipments,
    reject_secondary_shipment,
    save_secondary_shipment,
)

router = APIRouter()


@router.get("/shipments", response_model=list[SecondaryShipment])
def shipments() -> list[SecondaryShipment]:
    return list_secondary_shipments()


@router.post("/shipments", response_model=SecondaryShipment)
def create_shipment(request: SaveSecondaryShipmentRequest) -> SecondaryShipment:
    try:
        return save_secondary_shipment(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/shipments/{shipment_id}/approve", response_model=SecondaryShipment)
def approve(shipment_id: str, request: DecideSecondaryShipmentRequest) -> SecondaryShipment:
    try:
        return approve_secondary_shipment(shipment_id, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/shipments/{shipment_id}/reject", response_model=SecondaryShipment)
def reject(shipment_id: str, request: DecideSecondaryShipmentRequest) -> SecondaryShipment:
    try:
        return reject_secondary_shipment(shipment_id, request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
