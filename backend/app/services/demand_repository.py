"""Demand Engine (Phase 2E, P1).

Captures business demand from any source (sales orders, customer forecasts,
annual forecasts, tenders, sales opportunities). demand_type is one of
confirmed / forecast / tender / opportunity; demand_source is the free-text
origin. Lifecycle: open -> active -> closed / cancelled. All writes audited.
"""

from __future__ import annotations

from datetime import datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.demand import DEMAND_STATUSES, DEMAND_TYPES, CreateDemandRequest, Demand, DemandStatusRequest


def _load() -> list[Demand]:
    return load_collection("demand", lambda payload: Demand(**payload))


def _save(records: list[Demand]) -> None:
    save_collection("demand", records, lambda record: record.demand_id)


def _next_id(existing: list[Demand]) -> str:
    numbers = [
        int(d.demand_id.split("-")[-1])
        for d in existing
        if d.demand_id.startswith("DEM-") and d.demand_id.split("-")[-1].isdigit()
    ]
    return f"DEM-{(max(numbers) + 1) if numbers else 1:04d}"


def create_demand(request: CreateDemandRequest) -> Demand:
    demand_type = request.demand_type.strip().lower()
    if demand_type not in DEMAND_TYPES:
        raise ValueError(f"Demand type must be one of {DEMAND_TYPES}.")
    if not request.country.strip() or not request.distributor.strip():
        raise ValueError("Country and distributor are mandatory for demand.")
    if request.quantity <= 0:
        raise ValueError("Demand quantity must be greater than zero.")

    records = _load()
    demand = Demand(
        demand_id=_next_id(records),
        item_code=request.item_code,
        country=request.country.strip(),
        distributor=request.distributor.strip(),
        customer=request.customer,
        demand_type=demand_type,
        demand_source=request.demand_source,
        quantity=request.quantity,
        required_date=request.required_date,
        confidence=request.confidence,
        status="open",
        created_by=request.actor,
        updated_at=datetime.now().isoformat(),
    )
    _save([demand, *records])
    record_audit_event(
        action="demand_create",
        module_name="demand",
        entity_name="demand",
        entity_id=demand.demand_id,
        actor=request.actor,
        new_value=demand,
    )
    return demand


def list_demand(
    status: str | None = None,
    item_code: str | None = None,
    country: str | None = None,
    distributor: str | None = None,
    demand_type: str | None = None,
) -> list[Demand]:
    records = _load()
    if status:
        records = [d for d in records if d.status.lower() == status.lower()]
    if item_code:
        records = [d for d in records if d.item_code.lower() == item_code.lower()]
    if country:
        records = [d for d in records if d.country.lower() == country.lower()]
    if distributor:
        records = [d for d in records if d.distributor.lower() == distributor.lower()]
    if demand_type:
        records = [d for d in records if d.demand_type.lower() == demand_type.lower()]
    return sorted(records, key=lambda d: d.updated_at or "", reverse=True)


def get_demand(demand_id: str) -> Demand | None:
    return next((d for d in _load() if d.demand_id == demand_id), None)


def update_demand_status(demand_id: str, request: DemandStatusRequest) -> Demand:
    status = request.status.strip().lower()
    if status not in DEMAND_STATUSES:
        raise ValueError(f"Status must be one of {DEMAND_STATUSES}.")
    records = _load()
    demand = next((d for d in records if d.demand_id == demand_id), None)
    if not demand:
        raise ValueError(f"Demand not found: {demand_id}")
    old_value = demand.model_copy()
    demand.status = status
    demand.updated_at = datetime.now().isoformat()
    _save(records)
    record_audit_event(
        action="demand_status",
        module_name="demand",
        entity_name="demand",
        entity_id=demand_id,
        actor=request.actor,
        old_value=old_value,
        new_value=demand,
    )
    return demand


def active_demand() -> list[Demand]:
    return [d for d in _load() if d.status in {"open", "active"}]
