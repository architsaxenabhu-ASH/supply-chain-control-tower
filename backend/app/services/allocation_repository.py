"""Allocation Engine (Phase 2D, P1).

Allocations commit a batch to a country + distributor (customer optional).
Vertical is derived from the Product Master. Lifecycle: draft -> active
(approved) -> consumed / released / reallocated. Every transition is audited.
"""

from __future__ import annotations

from datetime import date, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.allocations import (
    Allocation,
    ApproveAllocationRequest,
    ConsumeAllocationRequest,
    CreateAllocationRequest,
)
from app.services.warehouse_repository import get_product

ACTIVE_STATUSES = {"active", "approved"}


def _load() -> list[Allocation]:
    return load_collection("allocations", lambda payload: Allocation(**payload))


def _save(allocations: list[Allocation]) -> None:
    save_collection("allocations", allocations, lambda allocation: allocation.allocation_id)


def _next_id(existing: list[Allocation]) -> str:
    numbers = [
        int(a.allocation_id.split("-")[-1])
        for a in existing
        if a.allocation_id.startswith("ALL-") and a.allocation_id.split("-")[-1].isdigit()
    ]
    return f"ALL-{(max(numbers) + 1) if numbers else 1:04d}"


def _product_vertical(item_code: str) -> str | None:
    product = get_product(item_code)
    return product.product_category if product else None


def create_allocation(request: CreateAllocationRequest) -> Allocation:
    if not request.country.strip():
        raise ValueError("Country is mandatory for an allocation.")
    if not request.distributor.strip():
        raise ValueError("Distributor is mandatory for an allocation.")
    if request.quantity <= 0:
        raise ValueError("Allocation quantity must be greater than zero.")

    allocations = _load()
    allocation = Allocation(
        allocation_id=_next_id(allocations),
        item_code=request.item_code,
        vertical=_product_vertical(request.item_code),
        country=request.country.strip(),
        distributor=request.distributor.strip(),
        customer=request.customer,
        batch_number=request.batch_number,
        quantity=request.quantity,
        allocation_date=(request.allocation_date or date.today().isoformat()),
        status="draft",
        created_by=request.actor,
        updated_at=datetime.now().isoformat(),
    )
    _save([allocation, *allocations])
    record_audit_event(
        action="allocate",
        module_name="allocations",
        entity_name="allocation",
        entity_id=allocation.allocation_id,
        actor=request.actor,
        new_value=allocation,
    )
    return allocation


def list_allocations(status: str | None = None, country: str | None = None, distributor: str | None = None) -> list[Allocation]:
    allocations = _load()
    if status:
        allocations = [a for a in allocations if a.status.lower() == status.lower()]
    if country:
        allocations = [a for a in allocations if a.country.lower() == country.lower()]
    if distributor:
        allocations = [a for a in allocations if a.distributor.lower() == distributor.lower()]
    return sorted(allocations, key=lambda a: a.allocation_date, reverse=True)


def get_allocation(allocation_id: str) -> Allocation | None:
    return next((a for a in _load() if a.allocation_id == allocation_id), None)


def _transition(allocation_id: str, action: str, actor: str, mutate) -> Allocation:
    allocations = _load()
    allocation = next((a for a in allocations if a.allocation_id == allocation_id), None)
    if not allocation:
        raise ValueError(f"Allocation not found: {allocation_id}")
    old_value = allocation.model_copy()
    mutate(allocation)
    allocation.updated_at = datetime.now().isoformat()
    _save(allocations)
    record_audit_event(
        action=action,
        module_name="allocations",
        entity_name="allocation",
        entity_id=allocation_id,
        actor=actor,
        old_value=old_value,
        new_value=allocation,
    )
    return allocation


def approve_allocation(allocation_id: str, request: ApproveAllocationRequest) -> Allocation:
    def mutate(allocation: Allocation) -> None:
        allocation.status = "active"
        allocation.approval_user = request.approval_user
        allocation.approval_date = date.today().isoformat()

    return _transition(allocation_id, "allocation_approve", request.approval_user, mutate)


def consume_allocation(allocation_id: str, request: ConsumeAllocationRequest) -> Allocation:
    if request.quantity <= 0:
        raise ValueError("Consumption quantity must be greater than zero.")

    def mutate(allocation: Allocation) -> None:
        allocation.consumed_quantity = min(allocation.quantity, allocation.consumed_quantity + request.quantity)
        if allocation.consumed_quantity >= allocation.quantity:
            allocation.status = "consumed"

    return _transition(allocation_id, "allocation_consume", request.actor, mutate)


def release_allocation(allocation_id: str, actor: str) -> Allocation:
    return _transition(allocation_id, "allocation_release", actor, lambda a: setattr(a, "status", "released"))


def mark_allocation_reallocated(allocation_id: str, actor: str) -> Allocation:
    return _transition(allocation_id, "allocation_reallocated", actor, lambda a: setattr(a, "status", "reallocated"))
