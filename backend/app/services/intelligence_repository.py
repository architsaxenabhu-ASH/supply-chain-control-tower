"""Operational intelligence (rules-based, no AI): inventory health, expiry
engine, business event feed, and system health. All values are derived from
data the platform already holds."""

from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta

from app.db.local_persistence import (
    list_audit_events,
    load_collection,
    record_audit_event,
    save_collection,
    verify_audit_chain,
)
from app.schemas.intelligence import (
    BusinessEvent,
    EventFeed,
    ExpiryBucketCounts,
    ExpiryEngineResponse,
    ExpiryLevelGroup,
    ExpiryRiskItem,
    InventoryHealth,
    InventoryHealthItem,
    InventoryHoldRequest,
    InventoryStatusBreakdown,
    SystemHealth,
)
from app.services.import_repository import list_import_candidates
from app.services.learning_repository import get_learning_insights
from app.services.local_document_store import list_saved_documents
from app.services.movement_repository import list_movement_events
from app.services.security_repository import list_security_users
from app.services.validation_repository import list_validation_queue
from app.services.warehouse_repository import (
    list_inventory_batches,
    list_products,
    list_shipments,
)

CONSUMPTION_WINDOW_DAYS = 90
STOCKOUT_COVERAGE_DAYS = 30
SLOW_MOVING_COVERAGE_DAYS = 180
EXCESS_COVERAGE_DAYS = 365
DEAD_STOCK_AGE_DAYS = 180


# --- Inventory holds (blocked / quarantine) ------------------------------

def _load_holds() -> list[dict]:
    return load_collection("inventory_holds", lambda payload: payload)


def record_inventory_hold(request: InventoryHoldRequest) -> dict:
    entry = {
        "item_code": request.item_code.strip(),
        "batch_number": request.batch_number.strip(),
        "hold_type": request.hold_type.strip().lower(),
        "actor": request.actor,
        "created_at": datetime.now().isoformat(),
    }
    holds = _load_holds()
    save_collection(
        "inventory_holds",
        [entry, *holds],
        lambda hold: f"{hold['item_code']}|{hold['batch_number']}|{hold['created_at']}",
    )
    record_audit_event(
        action=entry["hold_type"],
        module_name="inventory",
        entity_name="inventory_hold",
        entity_id=f"{entry['item_code']}/{entry['batch_number']}",
        actor=request.actor,
        new_value=entry,
    )
    return entry


def _current_holds() -> dict[tuple[str, str], str]:
    latest: dict[tuple[str, str], str] = {}
    for hold in sorted(_load_holds(), key=lambda h: h.get("created_at", "")):
        latest[(hold["item_code"].lower(), hold["batch_number"].lower())] = hold["hold_type"]
    return {key: value for key, value in latest.items() if value in {"blocked", "quarantine"}}


def _reserved_by_batch() -> dict[tuple[str, str], float]:
    reserved: dict[tuple[str, str], float] = {}
    for shipment in list_shipments():
        if shipment.status.value not in {"submitted", "approved"}:
            continue
        for line in shipment.lines:
            key = (line.item_code.lower(), line.batch_number.lower())
            reserved[key] = reserved.get(key, 0) + float(line.quantity_approved or line.quantity_requested or 0)
    return reserved


def inventory_status() -> InventoryStatusBreakdown:
    batches = list_inventory_batches()
    reserved_map = _reserved_by_batch()
    holds = _current_holds()
    result = InventoryStatusBreakdown()

    for batch in batches:
        qty = batch.quantity_available
        result.total_quantity += qty
        result.total_value += batch.inventory_value
        result.batch_count += 1

        if batch.days_to_expiry < 0:
            result.expired_quantity += qty
            continue

        key = (batch.item_code.lower(), batch.batch_number.lower())
        hold = holds.get(key)
        if hold == "blocked":
            result.blocked_quantity += qty
            continue
        if hold == "quarantine":
            result.quarantine_quantity += qty
            continue

        reserved = min(qty, reserved_map.get(key, 0))
        available = qty - reserved
        result.reserved_quantity += reserved
        result.available_quantity += available
        result.available_value += batch.inventory_value * (available / qty if qty else 0)

    return result


def _consumption_by_item() -> dict[str, float]:
    cutoff = (date.today() - timedelta(days=CONSUMPTION_WINDOW_DAYS)).isoformat()
    totals: dict[str, float] = {}
    for event in list_movement_events(event_type="dispatch"):
        if (event.occurred_at or "")[:10] >= cutoff:
            totals[event.item_code] = totals.get(event.item_code, 0) + abs(event.quantity)
    return totals


def _last_movement_days_by_item() -> dict[str, int]:
    latest: dict[str, str] = {}
    for event in list_movement_events():
        day = (event.occurred_at or "")[:10]
        if not day:
            continue
        if event.item_code not in latest or day > latest[event.item_code]:
            latest[event.item_code] = day
    result: dict[str, int] = {}
    for item, day in latest.items():
        try:
            result[item] = (date.today() - date.fromisoformat(day)).days
        except ValueError:
            continue
    return result


def inventory_health() -> InventoryHealth:
    batches = list_inventory_batches()
    consumption = _consumption_by_item()
    last_move = _last_movement_days_by_item()
    today = date.today()

    by_item: dict[str, list] = {}
    for batch in batches:
        by_item.setdefault(batch.item_code, []).append(batch)

    health = InventoryHealth()
    for item_code, item_batches in by_item.items():
        on_hand = sum(b.quantity_available for b in item_batches)
        if on_hand <= 0:
            continue
        daily = consumption.get(item_code, 0) / CONSUMPTION_WINDOW_DAYS
        coverage = round(on_hand / daily, 1) if daily > 0 else None
        oldest_age = max((today - b.manufacturing_date).days for b in item_batches)

        if daily == 0 and oldest_age >= DEAD_STOCK_AGE_DAYS:
            category = "dead"
        elif coverage is not None and coverage < STOCKOUT_COVERAGE_DAYS:
            category = "stockout_risk"
        elif coverage is not None and coverage > EXCESS_COVERAGE_DAYS:
            category = "excess"
        elif coverage is not None and coverage > SLOW_MOVING_COVERAGE_DAYS:
            category = "slow_moving"
        elif daily == 0:
            category = "slow_moving"
        else:
            category = "healthy"

        health.items.append(
            InventoryHealthItem(
                item_code=item_code,
                on_hand=on_hand,
                avg_daily_consumption=round(daily, 3),
                days_of_coverage=coverage,
                oldest_age_days=oldest_age,
                last_movement_days=last_move.get(item_code),
                category=category,
            )
        )
        setattr(health, "dead_stock" if category == "dead" else category, getattr(health, "dead_stock" if category == "dead" else category) + 1)
        if oldest_age <= 90:
            health.aging_0_90 += 1
        elif oldest_age <= 180:
            health.aging_91_180 += 1
        elif oldest_age <= 365:
            health.aging_181_365 += 1
        else:
            health.aging_over_365 += 1

    health.items.sort(key=lambda i: (i.days_of_coverage is None, i.days_of_coverage or 0))
    return health


# --- Expiry engine -------------------------------------------------------

def _risk_score(days_to_expiry: int) -> int:
    if days_to_expiry < 0:
        return 100
    if days_to_expiry <= 30:
        return 90
    if days_to_expiry <= 60:
        return 70
    if days_to_expiry <= 90:
        return 50
    if days_to_expiry <= 180:
        return 25
    return 5


def _batch_country_map() -> dict[tuple[str, str], str]:
    mapping: dict[tuple[str, str], str] = {}
    for candidate in list_import_candidates():
        for line in candidate.lines:
            mapping[(line.item_code.lower(), line.batch_number.lower())] = candidate.destination_country
    return mapping


def expiry_engine() -> ExpiryEngineResponse:
    batches = list_inventory_batches()
    country_map = _batch_country_map()
    buckets = ExpiryBucketCounts()
    value_at_risk_90 = 0.0

    for batch in batches:
        days = batch.days_to_expiry
        if days < 0:
            buckets.expired += 1
        elif days <= 30:
            buckets.bucket_0_30 += 1
        elif days <= 60:
            buckets.bucket_31_60 += 1
        elif days <= 90:
            buckets.bucket_61_90 += 1
        elif days <= 180:
            buckets.bucket_91_180 += 1
        else:
            buckets.bucket_180_plus += 1
        if 0 <= days <= 90:
            value_at_risk_90 += batch.inventory_value

    def risk_item(batch) -> ExpiryRiskItem:
        return ExpiryRiskItem(
            item_code=batch.item_code,
            batch_number=batch.batch_number,
            warehouse=batch.warehouse_location,
            expiry_date=batch.expiry_date.isoformat(),
            days_to_expiry=batch.days_to_expiry,
            quantity=batch.quantity_available,
            value=batch.inventory_value,
            risk_score=_risk_score(batch.days_to_expiry),
        )

    upcoming = sorted((b for b in batches if b.days_to_expiry >= 0), key=lambda b: b.days_to_expiry)
    soonest_batches = [risk_item(b) for b in upcoming[:10]]

    earliest_per_item: dict[str, object] = {}
    for batch in upcoming:
        current = earliest_per_item.get(batch.item_code)
        if current is None or batch.days_to_expiry < current.days_to_expiry:
            earliest_per_item[batch.item_code] = batch
    soonest_products = [
        risk_item(b) for b in sorted(earliest_per_item.values(), key=lambda b: b.days_to_expiry)[:10]
    ]

    def level(group_fn) -> list[ExpiryLevelGroup]:
        groups: dict[str, list[float]] = {}
        for batch in batches:
            if not (0 <= batch.days_to_expiry <= 90):
                continue
            key = group_fn(batch)
            if not key:
                continue
            bucket = groups.setdefault(key, [0, 0.0])
            bucket[0] += 1
            bucket[1] += batch.inventory_value
        return [
            ExpiryLevelGroup(key=key, expiring_90=int(value[0]), value_at_risk_90=value[1])
            for key, value in sorted(groups.items())
        ]

    return ExpiryEngineResponse(
        buckets=buckets,
        value_at_risk_90=value_at_risk_90,
        soonest_products=soonest_products,
        soonest_batches=soonest_batches,
        by_warehouse=level(lambda b: b.warehouse_location),
        by_product=level(lambda b: b.item_code),
        by_country=level(lambda b: country_map.get((b.item_code.lower(), b.batch_number.lower()), "Unknown")),
    )


# --- Event engine --------------------------------------------------------

EVENT_TYPE_LABELS = {
    ("import", "assemble"): "Shipment Created",
    ("import", "approve"): "Validation Approved",
    ("import", "mark_delivered"): "Shipment Delivered",
    ("import", "post_goods_receipt"): "Goods Received",
    ("import", "plan"): "Shipment Planned",
    ("learning", "correct"): "Validation Corrected",
    ("learning", "learn"): "Learning Recorded",
    ("movement", "record"): "Movement Recorded",
    ("inventory", "blocked"): "Inventory Blocked",
    ("inventory", "quarantine"): "Inventory Quarantined",
    ("master_data", "create"): "Master Record Created",
    ("master_data", "update"): "Master Record Updated",
    ("master_data", "deactivate"): "Master Record Deactivated",
    ("security", "login"): "User Login",
    ("security", "upsert_user"): "User Updated",
}


def _event_type(event: dict) -> str:
    label = EVENT_TYPE_LABELS.get((event.get("module_name"), event.get("action")))
    return label or f"{event.get('module_name')}.{event.get('action')}"


def event_feed(limit: int = 200, event_type: str | None = None) -> EventFeed:
    events: list[BusinessEvent] = []
    for raw in list_audit_events(limit=limit):
        events.append(
            BusinessEvent(
                event_id=raw["id"],
                event_type=_event_type(raw),
                timestamp=raw["created_at"],
                user=raw.get("actor"),
                user_role=raw.get("actor_role"),
                source_screen=raw.get("source_screen"),
                related_entity=raw.get("entity_name", ""),
                related_record=raw.get("entity_id", ""),
            )
        )
    if event_type:
        events = [e for e in events if e.event_type == event_type]
    return EventFeed(events=events, total=len(events), by_type=dict(Counter(e.event_type for e in events)))


# --- System health -------------------------------------------------------

def system_health() -> SystemHealth:
    documents = list_saved_documents()
    extracted = sum(1 for d in documents if (getattr(d, "extracted_field_count", 0) or 0) > 0)
    ocr_rate = round(extracted / len(documents) * 100, 1) if documents else 0.0
    chain = verify_audit_chain()

    return SystemHealth(
        total_users=len(list_security_users()),
        total_products=len(list_products()),
        total_documents=len(documents),
        ocr_success_rate=ocr_rate,
        validation_queue_size=list_validation_queue().total_count,
        open_shipments=sum(
            1 for s in list_shipments() if s.status.value in {"draft", "submitted", "approved"}
        ),
        inventory_records=len(list_inventory_batches()),
        learning_rules=get_learning_insights().total_learning_rules,
        audit_events=chain["total"],
        audit_chain_valid=chain["valid"],
        database_health="ok",
    )
