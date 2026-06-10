from __future__ import annotations

from datetime import datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.movements import (
    BatchTraceability,
    MovementEvent,
    ProductJourney,
    RecordMovementRequest,
)
from app.services.warehouse_repository import (
    list_dispatches,
    list_goods_receipts,
    list_inventory_batches,
    list_shipments,
)


def _persisted_events() -> list[MovementEvent]:
    return load_collection("movement_events", lambda payload: MovementEvent(**payload))


def record_movement_event(request: RecordMovementRequest) -> MovementEvent:
    """Record a manual movement (e.g. transfer, adjustment, location change) that
    is not already implied by a goods receipt or dispatch."""
    occurred_at = request.occurred_at or datetime.now().date().isoformat()
    event = MovementEvent(
        event_id=f"manual:{request.event_type}:{request.item_code}:{request.batch_number}:{occurred_at}:{datetime.now().timestamp()}",
        event_type=request.event_type,
        item_code=request.item_code,
        batch_number=request.batch_number,
        serial_number=request.serial_number,
        quantity=request.quantity,
        warehouse=request.warehouse,
        location=request.location or request.warehouse,
        counterparty=request.counterparty,
        reference=request.reference,
        actor=request.actor,
        occurred_at=occurred_at,
        note=request.note,
    )
    events = _persisted_events()
    save_collection(
        "movement_events",
        [event, *events],
        lambda saved: saved.event_id,
    )
    record_audit_event(
        action="record",
        module_name="movement",
        entity_name="movement_event",
        entity_id=event.event_id,
        actor=event.actor,
        new_value=event,
    )
    return event


def _derive_events() -> list[MovementEvent]:
    """Project the movement ledger from already-persisted history: every goods
    receipt is an inbound event, every dispatch (joined to its shipment lines) is
    an outbound event. Deterministic ids make this idempotent."""
    events: list[MovementEvent] = []

    for grn in list_goods_receipts():
        for line in grn.lines:
            events.append(
                MovementEvent(
                    event_id=f"receipt:{grn.grn_number}:{line.item_code}:{line.batch_number}",
                    event_type="receipt",
                    item_code=line.item_code,
                    batch_number=line.batch_number,
                    quantity=float(line.quantity_received),
                    warehouse=grn.warehouse,
                    location=grn.warehouse,
                    counterparty=grn.supplier,
                    reference=grn.grn_number,
                    occurred_at=grn.receipt_date.isoformat(),
                )
            )

    shipments = {shipment.shipment_id: shipment for shipment in list_shipments()}
    for dispatch in list_dispatches():
        shipment = shipments.get(dispatch.shipment_id)
        if not shipment:
            continue
        for line in shipment.lines:
            quantity = float(line.quantity_approved or line.quantity_requested or 0)
            if quantity <= 0:
                continue
            events.append(
                MovementEvent(
                    event_id=f"dispatch:{dispatch.dispatch_number}:{line.item_code}:{line.batch_number}",
                    event_type="dispatch",
                    item_code=line.item_code,
                    batch_number=line.batch_number,
                    quantity=-quantity,
                    warehouse=line.warehouse_location,
                    location=f"Dispatched to {shipment.customer_name}",
                    counterparty=shipment.customer_name,
                    reference=dispatch.dispatch_number,
                    actor=dispatch.dispatched_by,
                    occurred_at=dispatch.dispatch_date.isoformat(),
                )
            )

    return events


def _all_events() -> list[MovementEvent]:
    by_id: dict[str, MovementEvent] = {event.event_id: event for event in _derive_events()}
    for event in _persisted_events():
        by_id[event.event_id] = event
    return sorted(by_id.values(), key=lambda event: event.occurred_at, reverse=True)


def list_movement_events(
    item_code: str | None = None,
    batch_number: str | None = None,
    event_type: str | None = None,
) -> list[MovementEvent]:
    def keep(event: MovementEvent) -> bool:
        if item_code and event.item_code.lower() != item_code.lower():
            return False
        if batch_number and event.batch_number.lower() != batch_number.lower():
            return False
        if event_type and event.event_type != event_type:
            return False
        return True

    return [event for event in _all_events() if keep(event)]


def get_batch_traceability(batch_number: str) -> BatchTraceability:
    key = batch_number.strip().lower()
    events = [event for event in _all_events() if event.batch_number.lower() == key]

    received = sum(event.quantity for event in events if event.event_type == "receipt")
    dispatched = -sum(event.quantity for event in events if event.event_type == "dispatch")

    inventory = [batch for batch in list_inventory_batches() if batch.batch_number.lower() == key]
    current = sum(batch.quantity_available for batch in inventory)
    expiry = inventory[0].expiry_date.isoformat() if inventory else None

    allocated = 0.0
    for shipment in list_shipments():
        if shipment.status.value not in {"submitted", "approved"}:
            continue
        for line in shipment.lines:
            if line.batch_number.lower() == key:
                allocated += float(line.quantity_approved or line.quantity_requested or 0)

    warehouses = sorted({event.warehouse for event in events if event.warehouse})
    customers = sorted(
        {event.counterparty for event in events if event.event_type == "dispatch" and event.counterparty}
    )
    item_codes = sorted({event.item_code for event in events})

    ordered_events = sorted(events, key=lambda event: event.occurred_at)
    current_location = None
    for event in reversed(ordered_events):
        if event.location or event.warehouse:
            current_location = event.location or event.warehouse
            break

    # Link the batch back to the import shipment that produced it, so the trace
    # shows the supplier / invoice / AWB documents end-to-end.
    supplier = invoice_number = awb_number = import_file_number = None
    from app.services.import_repository import list_import_candidates

    for candidate in list_import_candidates():
        if any(line.batch_number.lower() == key for line in candidate.lines):
            supplier = candidate.supplier_name
            invoice_number = candidate.invoice_number
            awb_number = candidate.awb_number
            import_file_number = candidate.import_file_number
            break

    return BatchTraceability(
        batch_number=batch_number,
        found=bool(events or inventory),
        item_codes=item_codes,
        supplier=supplier,
        invoice_number=invoice_number,
        awb_number=awb_number,
        import_file_number=import_file_number,
        received_quantity=received,
        dispatched_quantity=dispatched,
        allocated_quantity=allocated,
        current_quantity=current,
        remaining_quantity=received - dispatched,
        expiry_date=expiry,
        current_location=current_location,
        warehouses=warehouses,
        customers=customers,
        events=ordered_events,
    )


def get_product_journey(query: str) -> ProductJourney:
    key = query.strip().lower()
    if not key:
        return ProductJourney(query=query, found=False, events=[])

    events = [
        event
        for event in _all_events()
        if key in event.item_code.lower()
        or key in event.batch_number.lower()
        or (event.serial_number or "").lower() == key
    ]
    ordered = sorted(events, key=lambda event: event.occurred_at)
    return ProductJourney(query=query, found=bool(ordered), events=ordered)
