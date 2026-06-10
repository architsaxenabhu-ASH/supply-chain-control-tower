"""Commercial intelligence (Phase 2F): customer (P4), distributor performance
(P5) and health (P6), country (P7), product (P8), inventory efficiency (P9), and
the executive command center (P10).

This module is pure composition - it reuses the demand, inventory, reservation,
allocation, reallocation, shipment, document, and intelligence engines already
built. No new data models, no AI; all scoring is transparent and rules-based.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.schemas.demand import (
    CountryPerformance,
    CustomerScorecardV2,
    DistributorHealth,
    DistributorPerformance,
    ExecutiveCommandCenter,
    InventoryEfficiency,
    ProductScorecard,
)
from app.services.allocation_repository import ACTIVE_STATUSES, list_allocations
from app.services.commitment_integration import inventory_commitment
from app.services.demand_intelligence import demand_intelligence
from app.services.demand_repository import active_demand, list_demand
from app.services.distribution_intelligence import (
    EXPIRY_RISK_DAYS,
    _batch_expiry_map,
    country_intelligence,
)
from app.services.document_readiness import document_readiness
from app.services.reallocation_repository import list_reallocations
from app.services.reservation_intelligence import commitment_dashboard
from app.services.reservation_repository import list_reservations
from app.services.shipment_intelligence import shipment_intelligence
from app.services.warehouse_repository import list_inventory_batches, list_shipments

LIVE_RESERVATION_STATUSES = {"active", "expiring_soon", "approved"}
SOLD_SHIPMENT_STATUSES = {"dispatched", "delivered"}
READY_STATUSES = {"Ready For Customs", "Ready For Warehouse", "Complete"}


# --- P4 customer intelligence v2 ----------------------------------------

def customer_intelligence_v2() -> list[CustomerScorecardV2]:
    shipments = list_shipments()
    reservations = list_reservations()
    allocations = list_allocations()
    demand = list_demand()
    reallocations = list_reallocations()

    customers: set[str] = set()
    customers |= {s.customer_name for s in shipments if s.customer_name}
    customers |= {d.customer for d in demand if d.customer}
    customers |= {r.customer for r in reservations if r.customer}
    customers |= {a.customer for a in allocations if a.customer}

    cards: list[CustomerScorecardV2] = []
    for customer in sorted(customers):
        key = customer.lower()
        historical_sales = sum(
            line.quantity_approved
            for s in shipments
            if s.customer_name.lower() == key and s.status.value in SOLD_SHIPMENT_STATUSES
            for line in s.lines
        )
        demand_history = sum(d.quantity for d in demand if (d.customer or "").lower() == key)
        cust_res = [r for r in reservations if (r.customer or "").lower() == key]
        cust_alloc = [a for a in allocations if (a.customer or "").lower() == key]
        reservation_history = sum(r.quantity for r in cust_res)
        allocation_history = sum(a.quantity for a in cust_alloc)
        consumption_history = sum(r.consumed_quantity for r in cust_res) + sum(a.consumed_quantity for a in cust_alloc)
        reallocation_history = sum(1 for r in reallocations if r.original_customer.lower() == key)
        committed = reservation_history + allocation_history
        cards.append(
            CustomerScorecardV2(
                customer=customer,
                historical_sales=historical_sales,
                demand_history=demand_history,
                reservation_history=reservation_history,
                consumption_history=consumption_history,
                allocation_history=allocation_history,
                reallocation_history=reallocation_history,
                utilization_pct=round(consumption_history / committed * 100, 1) if committed else None,
            )
        )
    return cards


# --- P5 distributor performance -----------------------------------------

def distributor_performance() -> list[DistributorPerformance]:
    allocations = list_allocations()
    reservations = list_reservations()
    batch_expiry = _batch_expiry_map()
    today = date.today()

    allocs_by_dist: dict[str, list] = defaultdict(list)
    for allocation in allocations:
        allocs_by_dist[allocation.distributor].append(allocation)
    res_by_dist: dict[str, list] = defaultdict(list)
    for reservation in reservations:
        if reservation.distributor:
            res_by_dist[reservation.distributor].append(reservation)

    cards: list[DistributorPerformance] = []
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
        dates = [date.fromisoformat(a.allocation_date) for a in allocs if a.allocation_date]
        span = max((today - min(dates)).days, 1) if dates else 1
        res = res_by_dist.get(distributor, [])
        res_reserved = sum(r.quantity for r in res)
        res_consumed = sum(r.consumed_quantity for r in res)
        cards.append(
            DistributorPerformance(
                distributor=distributor,
                inventory_allocated=allocated,
                inventory_consumed=consumed,
                reservation_utilization_pct=round(res_consumed / res_reserved * 100, 1) if res_reserved else None,
                allocation_utilization_pct=round(consumed / allocated * 100, 1) if allocated else None,
                consumption_rate=round(consumed / span, 3),
                reallocation_count=sum(1 for a in allocs if a.status == "reallocated"),
                expiry_pct=round(near / total * 100, 1) if total else None,
                active_products=len({a.item_code for a in active}),
                active_customers=len({a.customer for a in allocs if a.customer}),
            )
        )
    return cards


# --- P6 distributor health ----------------------------------------------

def distributor_health() -> list[DistributorHealth]:
    results: list[DistributorHealth] = []
    for performance in distributor_performance():
        allocation_util = performance.allocation_utilization_pct
        reservation_util = performance.reservation_utilization_pct
        turnover = allocation_util  # consumed/allocated is the turnover proxy
        expiry_performance = (100 - performance.expiry_pct) if performance.expiry_pct is not None else None
        reallocation_performance = max(0, 100 - performance.reallocation_count * 25)

        components = [c for c in (allocation_util, reservation_util, turnover, expiry_performance, reallocation_performance) if c is not None]
        score = round(sum(components) / len(components), 1) if components else 0.0

        if performance.expiry_pct is not None and performance.expiry_pct > 40:
            category = "High Expiry Risk"
        elif score >= 75:
            category = "High Performer"
        elif score >= 55:
            category = "Stable Performer"
        elif (allocation_util or 0) < 40 and performance.active_products >= 2:
            category = "High Growth Opportunity"
        else:
            category = "Underperformer"

        explanation = (
            f"score {score} from allocation util {allocation_util}%, reservation util {reservation_util}%, "
            f"expiry performance {expiry_performance}, reallocations {performance.reallocation_count}."
        )
        results.append(
            DistributorHealth(
                distributor=performance.distributor,
                health_score=score,
                category=category,
                consumption_rate=performance.consumption_rate,
                inventory_turnover=turnover,
                reservation_utilization_pct=reservation_util,
                allocation_utilization_pct=allocation_util,
                expiry_performance=expiry_performance,
                reallocation_performance=reallocation_performance,
                explanation=explanation,
            )
        )
    return sorted(results, key=lambda r: -r.health_score)


# --- P7 country performance ---------------------------------------------

def country_performance() -> list[CountryPerformance]:
    demand_by_country: dict[str, float] = defaultdict(float)
    for record in active_demand():
        demand_by_country[record.country] += record.quantity

    results: list[CountryPerformance] = []
    for scorecard in country_intelligence():
        results.append(
            CountryPerformance(
                country=scorecard.country,
                inventory_value=scorecard.inventory_value,
                demand=demand_by_country.get(scorecard.country, 0),
                reservations=scorecard.reservations,
                allocations=scorecard.allocations,
                consumption=scorecard.consumption,
                expiry_risk_batches=scorecard.expiry_risk_batches,
                shipment_on_time_pct=scorecard.shipment_on_time_pct,
            )
        )
    # Include demand-only countries that have no inventory/allocations yet.
    seen = {r.country.lower() for r in results}
    for country, demand_qty in demand_by_country.items():
        if country.lower() not in seen:
            results.append(CountryPerformance(country=country, demand=demand_qty))
    return sorted(results, key=lambda r: -r.inventory_value)


# --- P8 product intelligence --------------------------------------------

def product_intelligence() -> list[ProductScorecard]:
    batches = list_inventory_batches()
    reservations = list_reservations()
    allocations = list_allocations()
    demand = active_demand()

    inventory: dict[str, float] = defaultdict(float)
    expiry_risk: dict[str, int] = defaultdict(int)
    for batch in batches:
        if batch.days_to_expiry >= 0:
            inventory[batch.item_code] += batch.quantity_available
        if 0 <= batch.days_to_expiry < EXPIRY_RISK_DAYS:
            expiry_risk[batch.item_code] += 1

    demand_by_product: dict[str, float] = defaultdict(float)
    for record in demand:
        demand_by_product[record.item_code] += record.quantity

    reserved: dict[str, float] = defaultdict(float)
    res_consumed: dict[str, float] = defaultdict(float)
    realloc: dict[str, int] = defaultdict(int)
    for reservation in reservations:
        res_consumed[reservation.item_code] += reservation.consumed_quantity
        if reservation.effective_status in LIVE_RESERVATION_STATUSES:
            reserved[reservation.item_code] += reservation.quantity - reservation.consumed_quantity
        if reservation.status == "reallocated":
            realloc[reservation.item_code] += 1

    allocated: dict[str, float] = defaultdict(float)
    alloc_consumed: dict[str, float] = defaultdict(float)
    for allocation in allocations:
        alloc_consumed[allocation.item_code] += allocation.consumed_quantity
        if allocation.status in ACTIVE_STATUSES:
            allocated[allocation.item_code] += allocation.quantity - allocation.consumed_quantity
        if allocation.status == "reallocated":
            realloc[allocation.item_code] += 1

    items = set(inventory) | set(demand_by_product) | set(reserved) | set(allocated)
    cards = [
        ProductScorecard(
            item_code=item_code,
            inventory=inventory.get(item_code, 0),
            demand=demand_by_product.get(item_code, 0),
            reservations=reserved.get(item_code, 0),
            allocations=allocated.get(item_code, 0),
            consumption=res_consumed.get(item_code, 0) + alloc_consumed.get(item_code, 0),
            expiry_risk_batches=expiry_risk.get(item_code, 0),
            reallocation_activity=realloc.get(item_code, 0),
        )
        for item_code in sorted(items)
    ]
    return cards


# --- P9 inventory efficiency --------------------------------------------

def inventory_efficiency() -> InventoryEfficiency:
    commitment = inventory_commitment()
    physical = commitment.physical_inventory
    committed = commitment.reserved_inventory + commitment.allocated_inventory
    waste = commitment.expired_inventory + commitment.blocked_inventory + commitment.quarantine_inventory

    at_risk_value = sum(
        b.inventory_value for b in list_inventory_batches() if b.days_to_expiry < EXPIRY_RISK_DAYS
    )

    utilization = round(committed / physical * 100, 1) if physical else None
    util_ratio = committed / physical if physical else 0
    waste_ratio = waste / physical if physical else 0
    efficiency = round(max(0, min(100, util_ratio * 100 * 0.5 + (1 - waste_ratio) * 100 * 0.5)), 1)

    return InventoryEfficiency(
        physical_inventory=commitment.physical_inventory,
        available_inventory=commitment.available_inventory,
        reserved_inventory=commitment.reserved_inventory,
        allocated_inventory=commitment.allocated_inventory,
        blocked_inventory=commitment.blocked_inventory,
        quarantine_inventory=commitment.quarantine_inventory,
        expired_inventory=commitment.expired_inventory,
        in_transit_inventory=commitment.in_transit_inventory,
        inventory_utilization_pct=utilization,
        inventory_at_risk_value=round(at_risk_value, 2),
        inventory_efficiency_score=efficiency,
    )


# --- P10 executive command center ---------------------------------------

def executive_command_center() -> ExecutiveCommandCenter:
    commitment = inventory_commitment()
    efficiency = inventory_efficiency()
    from app.services.release_repository import available_not_sellable

    not_sellable = sum(b.quantity for b in available_not_sellable())

    demand = demand_intelligence()
    total_confirmed = sum(p.confirmed_demand for p in demand.by_product)
    total_forecast = sum(p.forecast_demand for p in demand.by_product)
    total_tender = sum(p.tender_demand for p in demand.by_product)
    total_opportunity = sum(p.opportunity_demand for p in demand.by_product)
    total_demand = total_confirmed + total_forecast + total_tender + total_opportunity
    coverage = round(min(commitment.available_inventory / total_demand, 1) * 100, 1) if total_demand else None

    health = distributor_health()
    top = [h.distributor for h in health if h.category in {"High Performer", "Stable Performer"}][:5]
    under = [h.distributor for h in health if h.category == "Underperformer"][:5]
    high_expiry = [h.distributor for h in health if h.category == "High Expiry Risk"][:5]

    countries = country_performance()
    highest_inventory_countries = [c.country for c in sorted(countries, key=lambda c: -c.inventory_value)[:3]]
    highest_demand_countries = [c.country for c in sorted(countries, key=lambda c: -c.demand)[:3]]
    highest_expiry_countries = [c.country for c in sorted(countries, key=lambda c: -c.expiry_risk_batches)[:3]]

    products = product_intelligence()
    highest_demand_products = [p.item_code for p in sorted(products, key=lambda p: -p.demand)[:3]]
    highest_inventory_products = [p.item_code for p in sorted(products, key=lambda p: -p.inventory)[:3]]
    highest_expiry_products = [p.item_code for p in sorted(products, key=lambda p: -p.expiry_risk_batches)[:3]]

    commitments = commitment_dashboard()

    readiness = document_readiness()
    shipments_ready = sum(1 for r in readiness if r.status in READY_STATUSES)
    shipments_missing_docs = sum(1 for r in readiness if r.missing_documents)
    shipments_delayed = sum(1 for s in shipment_intelligence() if s.is_delayed)

    return ExecutiveCommandCenter(
        total_inventory_value=round(commitment.physical_value, 2),
        inventory_at_risk_value=efficiency.inventory_at_risk_value,
        available_inventory=commitment.available_inventory,
        reserved_inventory=commitment.reserved_inventory,
        allocated_inventory=commitment.allocated_inventory,
        not_sellable_inventory=not_sellable,
        confirmed_demand=total_confirmed,
        forecast_demand=total_forecast,
        tender_demand=total_tender,
        opportunity_demand=total_opportunity,
        demand_coverage_pct=coverage,
        top_distributors=top,
        underperforming_distributors=under,
        high_expiry_risk_distributors=high_expiry,
        highest_inventory_countries=highest_inventory_countries,
        highest_demand_countries=highest_demand_countries,
        highest_expiry_exposure_countries=highest_expiry_countries,
        highest_demand_products=highest_demand_products,
        highest_inventory_products=highest_inventory_products,
        highest_expiry_risk_products=highest_expiry_products,
        reservation_value_at_risk=commitments.reservation_value_at_risk,
        reservations_expiring_soon=commitments.expiring_within_15_days,
        reservation_reallocation_candidates=commitments.reallocation_candidates,
        shipments_ready=shipments_ready,
        shipments_delayed=shipments_delayed,
        shipments_missing_documents=shipments_missing_docs,
    )
