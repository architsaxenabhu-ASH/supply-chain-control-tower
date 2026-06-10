"""Inventory Commitment Integration (Phase 2D, P2) - the single source of truth.

Combines physical inventory with active reservations, active allocations, holds
(blocked / quarantine), expiry, and in-transit imports into one set of buckets.
Both reservations AND allocations reduce Available Inventory, computed per batch
so the same quantity is never counted in two buckets."""

from __future__ import annotations

from app.schemas.allocations import InventoryCommitment
from app.services.allocation_repository import ACTIVE_STATUSES, list_allocations
from app.services.import_repository import list_import_candidates
from app.services.intelligence_repository import _current_holds
from app.services.reservation_repository import list_reservations
from app.services.warehouse_repository import list_inventory_batches

LIVE_RESERVATION_STATUSES = {"active", "expiring_soon", "approved"}
NOT_IN_TRANSIT_IMPORT_STATUSES = {"received", "closed"}


def _reserved_by_batch() -> dict[tuple[str, str], float]:
    reserved: dict[tuple[str, str], float] = {}
    for reservation in list_reservations():
        if reservation.effective_status in LIVE_RESERVATION_STATUSES:
            remaining = reservation.quantity - reservation.consumed_quantity
            if remaining > 0:
                key = (reservation.item_code.lower(), reservation.batch_number.lower())
                reserved[key] = reserved.get(key, 0) + remaining
    return reserved


def _allocated_by_batch() -> dict[tuple[str, str], float]:
    allocated: dict[tuple[str, str], float] = {}
    for allocation in list_allocations():
        if allocation.status in ACTIVE_STATUSES:
            remaining = allocation.quantity - allocation.consumed_quantity
            if remaining > 0:
                key = (allocation.item_code.lower(), allocation.batch_number.lower())
                allocated[key] = allocated.get(key, 0) + remaining
    return allocated


def inventory_commitment() -> InventoryCommitment:
    batches = list_inventory_batches()
    holds = _current_holds()
    reserved_map = _reserved_by_batch()
    allocated_map = _allocated_by_batch()
    commitment = InventoryCommitment()

    for batch in batches:
        qty = batch.quantity_available
        commitment.physical_inventory += qty
        commitment.physical_value += batch.inventory_value

        if batch.days_to_expiry < 0:
            commitment.expired_inventory += qty
            continue

        key = (batch.item_code.lower(), batch.batch_number.lower())
        hold = holds.get(key)
        if hold == "blocked":
            commitment.blocked_inventory += qty
            continue
        if hold == "quarantine":
            commitment.quarantine_inventory += qty
            continue

        reserved = min(qty, reserved_map.get(key, 0))
        allocated = min(qty - reserved, allocated_map.get(key, 0))
        available = qty - reserved - allocated
        commitment.reserved_inventory += reserved
        commitment.allocated_inventory += allocated
        commitment.available_inventory += available
        commitment.available_value += batch.inventory_value * (available / qty if qty else 0)

    for candidate in list_import_candidates():
        if candidate.status.value not in NOT_IN_TRANSIT_IMPORT_STATUSES:
            commitment.in_transit_inventory += sum(line.quantity for line in candidate.lines)

    return commitment
