"""Distribution intelligence (Phase 2D): distributor scorecards (P3), country
scorecards (P4), rules-based allocation recommendations (P5), and the allocation
dashboard (P6). No AI - recommendations are transparent, scored heuristics that
never auto-allocate."""

from __future__ import annotations

from collections import Counter, defaultdict

from app.schemas.allocations import (
    AllocationDashboard,
    AllocationRecommendation,
    CountryScorecard,
    DistributorScorecard,
)
from app.services.allocation_repository import ACTIVE_STATUSES, list_allocations
from app.services.import_repository import get_shipment_timeline, list_import_candidates
from app.services.reservation_repository import list_reservations
from app.services.warehouse_repository import list_inventory_batches

EXPIRY_RISK_DAYS = 182


def _batch_expiry_map() -> dict[tuple[str, str], int]:
    return {
        (b.item_code.lower(), b.batch_number.lower()): b.days_to_expiry for b in list_inventory_batches()
    }


def _batch_country_map() -> dict[tuple[str, str], str]:
    mapping: dict[tuple[str, str], str] = {}
    for candidate in list_import_candidates():
        for line in candidate.lines:
            mapping[(line.item_code.lower(), line.batch_number.lower())] = candidate.destination_country
    return mapping


def _unit_value_map() -> dict[tuple[str, str], float]:
    values: dict[tuple[str, str], float] = {}
    for batch in list_inventory_batches():
        qty = batch.quantity_available or 0
        values[(batch.item_code.lower(), batch.batch_number.lower())] = batch.inventory_value / qty if qty else 0
    return values


# --- P3 distributor intelligence ----------------------------------------

def distributor_intelligence() -> list[DistributorScorecard]:
    allocations = list_allocations()
    reservations = list_reservations()
    batch_expiry = _batch_expiry_map()

    allocs_by_dist: dict[str, list] = defaultdict(list)
    for allocation in allocations:
        allocs_by_dist[allocation.distributor].append(allocation)
    res_by_dist: dict[str, list] = defaultdict(list)
    for reservation in reservations:
        if reservation.distributor:
            res_by_dist[reservation.distributor].append(reservation)

    cards: list[DistributorScorecard] = []
    for distributor, allocs in sorted(allocs_by_dist.items()):
        allocated = sum(a.quantity for a in allocs)
        consumed = sum(a.consumed_quantity for a in allocs)
        active = [a for a in allocs if a.status in ACTIVE_STATUSES]
        near = total = 0
        for allocation in active:
            days = batch_expiry.get((allocation.item_code.lower(), allocation.batch_number.lower()))
            total += 1
            if days is not None and days < EXPIRY_RISK_DAYS:
                near += 1
        res = res_by_dist.get(distributor, [])
        res_reserved = sum(r.quantity for r in res)
        res_consumed = sum(r.consumed_quantity for r in res)
        cards.append(
            DistributorScorecard(
                distributor=distributor,
                inventory_allocated=allocated,
                inventory_consumed=consumed,
                allocation_utilization_pct=round(consumed / allocated * 100, 1) if allocated else None,
                reservation_utilization_pct=round(res_consumed / res_reserved * 100, 1) if res_reserved else None,
                reallocation_count=sum(1 for a in allocs if a.status == "reallocated"),
                expiry_pct=round(near / total * 100, 1) if total else None,
                active_products=len({a.item_code for a in active}),
                active_batches=len({a.batch_number for a in active}),
            )
        )
    return cards


# --- P4 country intelligence --------------------------------------------

def country_intelligence() -> list[CountryScorecard]:
    allocations = list_allocations()
    reservations = list_reservations()
    candidates = list_import_candidates()
    batch_country = _batch_country_map()
    batches = list_inventory_batches()

    countries = {a.country for a in allocations} | {c.destination_country for c in candidates}
    countries |= set(batch_country.values())

    cards: list[CountryScorecard] = []
    for country in sorted(c for c in countries if c):
        country_allocs = [a for a in allocations if a.country.lower() == country.lower()]
        country_res = [
            r
            for r in reservations
            if batch_country.get((r.item_code.lower(), r.batch_number.lower()), "").lower() == country.lower()
        ]
        inventory_value = 0.0
        expiry_risk = 0
        for batch in batches:
            if batch_country.get((batch.item_code.lower(), batch.batch_number.lower()), "").lower() == country.lower():
                inventory_value += batch.inventory_value
                if 0 <= batch.days_to_expiry < EXPIRY_RISK_DAYS:
                    expiry_risk += 1
        consumption = sum(a.consumed_quantity for a in country_allocs) + sum(r.consumed_quantity for r in country_res)
        on_time = late = 0
        for candidate in candidates:
            if candidate.destination_country.lower() == country.lower():
                timeline = get_shipment_timeline(candidate.import_file_number)
                on_time += timeline.on_time_count
                late += timeline.late_count
        cards.append(
            CountryScorecard(
                country=country,
                inventory_value=round(inventory_value, 2),
                reservations=len(country_res),
                allocations=len(country_allocs),
                consumption=consumption,
                expiry_risk_batches=expiry_risk,
                shipment_on_time_pct=round(on_time / (on_time + late) * 100, 1) if (on_time + late) else None,
            )
        )
    return cards


# --- P5 allocation recommendations --------------------------------------

def allocation_recommendations(item_code: str | None = None) -> list[AllocationRecommendation]:
    cards = distributor_intelligence()
    allocations = list_allocations()

    target_expiry_risk = False
    if item_code:
        for batch in list_inventory_batches():
            if batch.item_code.lower() == item_code.lower() and 0 <= batch.days_to_expiry < EXPIRY_RISK_DAYS:
                target_expiry_risk = True
                break

    distributor_country: dict[str, str] = {}
    for distributor in {a.distributor for a in allocations}:
        counter = Counter(a.country for a in allocations if a.distributor == distributor)
        distributor_country[distributor] = counter.most_common(1)[0][0] if counter else "Unknown"

    recommendations: list[AllocationRecommendation] = []
    for card in cards:
        utilization = card.allocation_utilization_pct or 0
        consumed = card.inventory_consumed
        open_exposure = card.inventory_allocated - card.inventory_consumed

        score = utilization * 0.5
        score += min(consumed / 10, 30)
        expiry_bonus = 20 if (target_expiry_risk and utilization >= 50) else 0
        score += expiry_bonus
        score -= min(open_exposure / 20, 15)
        score = round(max(score, 0), 1)

        explanation = f"Utilisation {utilization}% with {consumed:g} consumed historically"
        if expiry_bonus:
            explanation += "; strong consumer helps reduce expiry risk"
        explanation += f"; current open allocation {open_exposure:g}."

        recommendations.append(
            AllocationRecommendation(
                item_code=item_code,
                recommended_country=distributor_country.get(card.distributor, "Unknown"),
                recommended_distributor=card.distributor,
                recommendation_score=score,
                explanation=explanation,
            )
        )
    return sorted(recommendations, key=lambda r: -r.recommendation_score)


# --- P6 allocation dashboard --------------------------------------------

def allocation_dashboard() -> AllocationDashboard:
    allocations = list_allocations()
    unit_values = _unit_value_map()
    batch_expiry = _batch_expiry_map()

    active = [a for a in allocations if a.status in ACTIVE_STATUSES]
    total_allocated = sum(a.quantity for a in allocations)
    total_consumed = sum(a.consumed_quantity for a in allocations)

    value = locked = 0.0
    country_exposure: dict[str, float] = defaultdict(float)
    distributor_exposure: dict[str, float] = defaultdict(float)
    reallocation_candidates = 0
    for allocation in active:
        remaining = allocation.quantity - allocation.consumed_quantity
        unit = unit_values.get((allocation.item_code.lower(), allocation.batch_number.lower()), 0)
        line_value = remaining * unit
        value += line_value
        locked += remaining
        country_exposure[allocation.country] += round(line_value, 2)
        distributor_exposure[allocation.distributor] += round(line_value, 2)
        consumption_pct = allocation.consumed_quantity / allocation.quantity if allocation.quantity else 0
        if consumption_pct < 0.5:
            reallocation_candidates += 1

    return AllocationDashboard(
        active_allocations=len(active),
        allocation_value=round(value, 2),
        allocation_utilization_pct=round(total_consumed / total_allocated * 100, 1) if total_allocated else None,
        reallocation_candidates=reallocation_candidates,
        country_exposure={k: round(v, 2) for k, v in country_exposure.items()},
        distributor_exposure={k: round(v, 2) for k, v in distributor_exposure.items()},
        inventory_locked_in_allocations=round(locked, 2),
    )
