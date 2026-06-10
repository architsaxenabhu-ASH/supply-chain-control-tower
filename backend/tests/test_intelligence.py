"""Operational intelligence: inventory health, expiry engine, events, system health."""

from app.schemas.intelligence import InventoryHoldRequest, SystemHealth
from app.services import intelligence_repository as ir
from app.services.warehouse_repository import list_inventory_batches


def test_inventory_status_quantities_reconcile_to_total():
    status = ir.inventory_status()
    parts = (
        status.available_quantity
        + status.reserved_quantity
        + status.blocked_quantity
        + status.quarantine_quantity
        + status.expired_quantity
    )
    assert round(parts, 2) == round(status.total_quantity, 2)


def test_expiry_buckets_cover_every_batch_once():
    engine = ir.expiry_engine()
    total_bucketed = (
        engine.buckets.bucket_0_30
        + engine.buckets.bucket_31_60
        + engine.buckets.bucket_61_90
        + engine.buckets.bucket_91_180
        + engine.buckets.bucket_180_plus
        + engine.buckets.expired
    )
    assert total_bucketed == len(list_inventory_batches())


def test_inventory_hold_is_recorded_and_reflected():
    ir.record_inventory_hold(
        InventoryHoldRequest(item_code="HOLD-1", batch_number="B-1", hold_type="blocked", actor="qa@example.com")
    )
    holds = ir._current_holds()
    assert holds.get(("hold-1", "b-1")) == "blocked"
    # Releasing clears the hold.
    ir.record_inventory_hold(
        InventoryHoldRequest(item_code="HOLD-1", batch_number="B-1", hold_type="release", actor="qa@example.com")
    )
    assert ("hold-1", "b-1") not in ir._current_holds()


def test_event_feed_by_type_sums_to_total():
    feed = ir.event_feed(limit=100)
    assert sum(feed.by_type.values()) == feed.total


def test_system_health_returns_model():
    health = ir.system_health()
    assert isinstance(health, SystemHealth)
    assert health.database_health == "ok"
    assert isinstance(health.audit_chain_valid, bool)
