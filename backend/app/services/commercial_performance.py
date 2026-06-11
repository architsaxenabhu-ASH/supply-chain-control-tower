"""Commercial Performance Intelligence (Phase 4, P2).

Country -> Vertical -> Distributor -> Customer scorecards with target vs actual,
achievement %, and diagnostic factors. Drill-down via parent query filters.

Honest basis: "actual" is realized consumption from allocations (which carry
country/vertical/distributor/customer), valued at inventory unit cost. Growth %
needs period-stamped history we do not yet keep, so it is reported as null.
"""

from __future__ import annotations

from collections import defaultdict

from app.schemas.commercial import PerformanceScorecard
from app.services.commercial_targets_repository import targets_by_value
from app.services.allocation_repository import list_allocations
from app.services.commitment_intelligence import _available_by_product, _unit_value_by_item
from app.services.demand_repository import active_demand


def _demand_by(attr: str) -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for demand in active_demand():
        key = getattr(demand, attr, None)
        if key:
            totals[str(key).lower()] += demand.quantity
    return totals


def _scope_value(allocation, scope: str) -> str | None:
    return {
        "country": allocation.country,
        "vertical": allocation.vertical,
        "distributor": allocation.distributor,
        "customer": allocation.customer,
    }.get(scope)


def _passes(allocation, country: str | None, vertical: str | None, distributor: str | None) -> bool:
    if country and (allocation.country or "").lower() != country.lower():
        return False
    if vertical and (allocation.vertical or "").lower() != vertical.lower():
        return False
    if distributor and (allocation.distributor or "").lower() != distributor.lower():
        return False
    return True


def _diagnostics(achievement, items, available, demand_qty) -> dict[str, str]:
    if achievement is None:
        sales = "no_target_set"
    elif achievement >= 100:
        sales = "strong"
    elif achievement >= 70:
        sales = "on_track"
    else:
        sales = "below_target"
    total_available = sum(available.get(item, 0) for item in items)
    return {
        "sales_performance": sales,
        "product_availability": "sufficient" if total_available > 0 else "constrained",
        "market_demand": "high" if demand_qty >= 100 else ("moderate" if demand_qty > 0 else "low"),
    }


def performance(scope: str, country=None, vertical=None, distributor=None) -> list[PerformanceScorecard]:
    allocations = list_allocations()
    unit_values = _unit_value_by_item()
    available = _available_by_product()
    targets = targets_by_value(scope)
    demand_totals = _demand_by({"country": "country", "vertical": None, "distributor": "distributor", "customer": "customer"}.get(scope) or "country")

    groups: dict[str, list] = defaultdict(list)
    for allocation in allocations:
        if not _passes(allocation, country, vertical, distributor):
            continue
        key = _scope_value(allocation, scope)
        if key:
            groups[key].append(allocation)

    # Seed scope values that have a target but no realised allocations yet, so a
    # 0%-achievement (under-performing) row is still visible at the top level.
    if not (country or vertical or distributor):
        for target in targets.values():
            groups.setdefault(target.scope_value, [])

    rows: list[PerformanceScorecard] = []
    for name, allocs in sorted(groups.items()):
        actual_quantity = sum(a.consumed_quantity for a in allocs)
        actual_value = sum(a.consumed_quantity * unit_values.get(a.item_code, 0) for a in allocs)
        target = targets.get(name.lower())
        target_value = target.target_value if target else 0
        target_quantity = target.target_quantity if target else 0
        value_achievement = round(actual_value / target_value * 100, 1) if target_value else None
        quantity_achievement = round(actual_quantity / target_quantity * 100, 1) if target_quantity else None
        items = {a.item_code for a in allocs}
        rows.append(
            PerformanceScorecard(
                scope=scope,
                name=name,
                target_value=round(target_value, 2),
                actual_value=round(actual_value, 2),
                value_achievement_pct=value_achievement,
                target_quantity=target_quantity,
                actual_quantity=actual_quantity,
                quantity_achievement_pct=quantity_achievement,
                growth_pct=None,
                diagnostics=_diagnostics(value_achievement, items, available, demand_totals.get(name.lower(), 0)),
            )
        )
    return rows
