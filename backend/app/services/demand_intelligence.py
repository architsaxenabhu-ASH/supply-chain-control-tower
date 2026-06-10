"""Demand Intelligence (P2) + Demand Gap Analysis (P3).

Composes the demand store with existing inventory, reservation, and allocation
engines - no new data models. Active demand = status open or active.
"""

from __future__ import annotations

from collections import defaultdict

from app.schemas.demand import (
    CountryDemand,
    DemandGap,
    DemandIntelligence,
    DistributorDemand,
    ProductDemand,
)
from app.services.allocation_repository import ACTIVE_STATUSES, list_allocations
from app.services.demand_repository import active_demand
from app.services.distribution_intelligence import _batch_country_map
from app.services.reservation_repository import list_reservations
from app.services.warehouse_repository import list_inventory_batches

LIVE_RESERVATION_STATUSES = {"active", "expiring_soon", "approved"}


def _inventory_by_product() -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for batch in list_inventory_batches():
        if batch.days_to_expiry >= 0:
            totals[batch.item_code] += batch.quantity_available
    return totals


def _reserved_by_product() -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for reservation in list_reservations():
        if reservation.effective_status in LIVE_RESERVATION_STATUSES:
            totals[reservation.item_code] += reservation.quantity - reservation.consumed_quantity
    return totals


def _allocated_by_product() -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for allocation in list_allocations():
        if allocation.status in ACTIVE_STATUSES:
            totals[allocation.item_code] += allocation.quantity - allocation.consumed_quantity
    return totals


def _demand_by_type_for(records) -> dict[str, float]:
    by_type: dict[str, float] = defaultdict(float)
    for demand in records:
        by_type[demand.demand_type] += demand.quantity
    return by_type


def demand_intelligence() -> DemandIntelligence:
    demand = active_demand()
    inventory = _inventory_by_product()
    reserved = _reserved_by_product()
    allocated = _allocated_by_product()
    batch_country = _batch_country_map()

    # by product
    demand_by_product: dict[str, list] = defaultdict(list)
    for record in demand:
        demand_by_product[record.item_code].append(record)
    product_rows: list[ProductDemand] = []
    for item_code in sorted(set(demand_by_product) | set(inventory)):
        by_type = _demand_by_type_for(demand_by_product.get(item_code, []))
        total = sum(by_type.values())
        physical = inventory.get(item_code, 0)
        available = max(physical - reserved.get(item_code, 0) - allocated.get(item_code, 0), 0)
        product_rows.append(
            ProductDemand(
                item_code=item_code,
                confirmed_demand=by_type.get("confirmed", 0),
                forecast_demand=by_type.get("forecast", 0),
                tender_demand=by_type.get("tender", 0),
                opportunity_demand=by_type.get("opportunity", 0),
                total_demand=total,
                available_inventory=available,
                demand_coverage_pct=round(min(available / total, 1) * 100, 1) if total else None,
                inventory_coverage_pct=round(physical / total * 100, 1) if total else None,
            )
        )

    # by country
    country_rows: dict[str, CountryDemand] = {}

    def _country_row(country: str) -> CountryDemand:
        return country_rows.setdefault(country, CountryDemand(country=country))

    for record in demand:
        _country_row(record.country).demand += record.quantity
    for batch in list_inventory_batches():
        country = batch_country.get((batch.item_code.lower(), batch.batch_number.lower()))
        if country and batch.days_to_expiry >= 0:
            _country_row(country).inventory += batch.quantity_available
    for reservation in list_reservations():
        if reservation.effective_status in LIVE_RESERVATION_STATUSES:
            country = batch_country.get((reservation.item_code.lower(), reservation.batch_number.lower()))
            if country:
                _country_row(country).reservations += reservation.quantity - reservation.consumed_quantity
    for allocation in list_allocations():
        if allocation.status in ACTIVE_STATUSES:
            _country_row(allocation.country).allocations += allocation.quantity - allocation.consumed_quantity

    # by distributor
    distributor_rows: dict[str, DistributorDemand] = {}

    def _dist_row(distributor: str) -> DistributorDemand:
        return distributor_rows.setdefault(distributor, DistributorDemand(distributor=distributor))

    for record in demand:
        _dist_row(record.distributor).demand += record.quantity
    for allocation in list_allocations():
        row = _dist_row(allocation.distributor)
        row.consumption += allocation.consumed_quantity
        if allocation.status in ACTIVE_STATUSES:
            row.inventory_exposure += allocation.quantity - allocation.consumed_quantity

    return DemandIntelligence(
        by_product=product_rows,
        by_country=sorted(country_rows.values(), key=lambda r: -r.demand),
        by_distributor=sorted(distributor_rows.values(), key=lambda r: -r.demand),
    )


def demand_gap() -> list[DemandGap]:
    demand = active_demand()
    inventory = _inventory_by_product()
    reserved = _reserved_by_product()
    allocated = _allocated_by_product()

    demand_by_product: dict[str, float] = defaultdict(float)
    for record in demand:
        demand_by_product[record.item_code] += record.quantity

    rows: list[DemandGap] = []
    for item_code in sorted(set(demand_by_product) | set(inventory)):
        total_demand = demand_by_product.get(item_code, 0)
        physical = inventory.get(item_code, 0)
        item_reserved = reserved.get(item_code, 0)
        item_allocated = allocated.get(item_code, 0)
        available = max(physical - item_reserved - item_allocated, 0)
        surplus = max(available - total_demand, 0)
        shortage = max(total_demand - available, 0)
        rows.append(
            DemandGap(
                item_code=item_code,
                total_demand=total_demand,
                physical_inventory=physical,
                reserved=item_reserved,
                allocated=item_allocated,
                available=available,
                surplus=surplus,
                shortage=shortage,
                coverage_pct=round(min(available / total_demand, 1) * 100, 1) if total_demand else None,
                at_risk_demand=shortage,
            )
        )
    return rows
