from fastapi import APIRouter

from app.schemas.fulfillment import AllocationPriority, CommercialReadiness, OrderFulfillment
from app.services.fulfillment_intelligence import (
    allocation_priority,
    commercial_readiness,
    order_fulfillment,
)

commercial_readiness_router = APIRouter()
order_fulfillment_router = APIRouter()
allocation_priority_router = APIRouter()


@commercial_readiness_router.get("", response_model=list[CommercialReadiness])
def readiness() -> list[CommercialReadiness]:
    return commercial_readiness()


@order_fulfillment_router.get("", response_model=list[OrderFulfillment])
def fulfillment() -> list[OrderFulfillment]:
    return order_fulfillment()


@allocation_priority_router.get("", response_model=list[AllocationPriority])
def priority() -> list[AllocationPriority]:
    return allocation_priority()
