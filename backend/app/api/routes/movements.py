from fastapi import APIRouter

from app.schemas.movements import (
    BatchTraceability,
    MovementEvent,
    ProductJourney,
    RecordMovementRequest,
)
from app.services.movement_repository import (
    get_batch_traceability,
    get_product_journey,
    list_movement_events,
    record_movement_event,
)


router = APIRouter()


@router.get("", response_model=list[MovementEvent])
def movements(
    item_code: str | None = None,
    batch_number: str | None = None,
    event_type: str | None = None,
) -> list[MovementEvent]:
    return list_movement_events(item_code=item_code, batch_number=batch_number, event_type=event_type)


@router.post("", response_model=MovementEvent)
def record_movement(request: RecordMovementRequest) -> MovementEvent:
    return record_movement_event(request)


@router.get("/traceability", response_model=BatchTraceability)
def traceability(batch_number: str) -> BatchTraceability:
    return get_batch_traceability(batch_number)


@router.get("/journey", response_model=ProductJourney)
def journey(query: str) -> ProductJourney:
    return get_product_journey(query)
