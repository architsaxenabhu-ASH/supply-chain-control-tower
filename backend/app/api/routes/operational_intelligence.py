from fastapi import APIRouter

from app.schemas.operational_intelligence import (
    DelayReasonRequest,
    DocumentControlTower,
    DocumentReadiness,
    ExpiryPrevention,
    ShipmentDelayInsight,
)
from app.services.document_control_tower import document_control_tower
from app.services.document_readiness import document_readiness
from app.services.expiry_prevention import expiry_prevention
from app.services.shipment_intelligence import record_delay_reason, shipment_intelligence

readiness_router = APIRouter()
control_tower_router = APIRouter()
shipment_router = APIRouter()
expiry_prevention_router = APIRouter()


@readiness_router.get("", response_model=list[DocumentReadiness])
def readiness() -> list[DocumentReadiness]:
    return document_readiness()


@control_tower_router.get("", response_model=DocumentControlTower)
def control_tower() -> DocumentControlTower:
    return document_control_tower()


@shipment_router.get("", response_model=list[ShipmentDelayInsight])
def shipments() -> list[ShipmentDelayInsight]:
    return shipment_intelligence()


@shipment_router.post("/delay-reason")
def delay_reason(request: DelayReasonRequest) -> dict:
    return record_delay_reason(request)


@expiry_prevention_router.get("", response_model=ExpiryPrevention)
def expiry() -> ExpiryPrevention:
    return expiry_prevention()
