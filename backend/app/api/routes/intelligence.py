from fastapi import APIRouter, Query

from app.schemas.intelligence import (
    EventFeed,
    ExpiryEngineResponse,
    InventoryHealth,
    InventoryHoldRequest,
    InventoryStatusBreakdown,
)
from app.services.intelligence_repository import (
    event_feed,
    expiry_engine,
    inventory_health,
    inventory_status,
    record_inventory_hold,
)

inventory_health_router = APIRouter()
expiry_router = APIRouter()
events_router = APIRouter()


@inventory_health_router.get("/status", response_model=InventoryStatusBreakdown)
def status() -> InventoryStatusBreakdown:
    return inventory_status()


@inventory_health_router.get("/health", response_model=InventoryHealth)
def health() -> InventoryHealth:
    return inventory_health()


@inventory_health_router.post("/hold")
def hold(request: InventoryHoldRequest) -> dict:
    return record_inventory_hold(request)


@expiry_router.get("", response_model=ExpiryEngineResponse)
def expiry() -> ExpiryEngineResponse:
    return expiry_engine()


@events_router.get("", response_model=EventFeed)
def events(
    limit: int = Query(default=200, ge=1, le=500),
    event_type: str | None = Query(default=None),
) -> EventFeed:
    return event_feed(limit=limit, event_type=event_type)
