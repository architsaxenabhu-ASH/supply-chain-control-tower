"""Customer Commitment Intelligence (Phase 4, P1): commitment risk + dashboard.

Composes the commitment store with existing inventory availability, incoming
(in-transit imports), allocations, and reservations. Detects risk and explains
it - it never decides. Management acts on the recommendations.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.schemas.commitments import CommitmentDashboard, CommitmentRisk
from app.services.commitment_repository import list_commitments
from app.services.demand_intelligence import _allocated_by_product, _inventory_by_product, _reserved_by_product
from app.services.import_repository import list_import_candidates
from app.services.warehouse_repository import list_inventory_batches

NOT_IN_TRANSIT = {"received", "closed"}


def _incoming_by_product() -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    for candidate in list_import_candidates():
        if candidate.status.value not in NOT_IN_TRANSIT:
            for line in candidate.lines:
                totals[line.item_code] += line.quantity
    return totals


def _unit_value_by_item() -> dict[str, float]:
    totals: dict[str, float] = defaultdict(float)
    quantities: dict[str, float] = defaultdict(float)
    for batch in list_inventory_batches():
        totals[batch.item_code] += batch.inventory_value
        quantities[batch.item_code] += batch.quantity_available
    return {item: (totals[item] / quantities[item] if quantities[item] else 0) for item in totals}


def _available_by_product() -> dict[str, float]:
    inventory = _inventory_by_product()
    reserved = _reserved_by_product()
    allocated = _allocated_by_product()
    return {item: max(inventory.get(item, 0) - reserved.get(item, 0) - allocated.get(item, 0), 0) for item in inventory}


def _assess(commitment, available, incoming, unit_values, today: date) -> CommitmentRisk:
    material = commitment.material
    shortfall = commitment.backorder_quantity
    avail = available.get(material, 0)
    inc = incoming.get(material, 0)
    try:
        days_to_required = (date.fromisoformat(commitment.required_delivery_date) - today).days
    except ValueError:
        days_to_required = 0

    fill_rate = round(commitment.delivered_quantity / commitment.ordered_quantity * 100, 1) if commitment.ordered_quantity else 0
    otif = commitment.status == "fulfilled" and days_to_required >= 0
    delay_days = max(0, -days_to_required) if commitment.status != "fulfilled" else 0
    backorder_value = round(shortfall * unit_values.get(material, 0), 2)

    reasons: list[str] = []
    if commitment.status == "fulfilled":
        level = "Low"
        reasons.append("Commitment fulfilled")
    elif shortfall <= 0:
        level = "Medium" if days_to_required < 7 else "Low"
        reasons.append("Covered by allocation/shipment; awaiting delivery")
    elif days_to_required < 0:
        level = "Critical"
        reasons.append(f"Past required date with {shortfall:g} units short")
    elif avail >= shortfall:
        level = "Medium" if days_to_required < 14 else "Low"
        reasons.append(f"Available inventory covers the {shortfall:g}-unit shortfall")
    elif avail + inc >= shortfall:
        level = "High" if days_to_required < 14 else "Medium"
        reasons.append(f"Shortfall needs incoming stock ({inc:g} in transit)")
    else:
        level = "Critical" if days_to_required < 7 else "High"
        reasons.append(f"Insufficient available ({avail:g}) + incoming ({inc:g}) for {shortfall:g}-unit shortfall")

    return CommitmentRisk(
        commitment_id=commitment.commitment_id,
        po_number=commitment.po_number,
        customer=commitment.customer,
        material=material,
        risk_level=level,
        fill_rate_pct=fill_rate,
        otif=otif,
        delay_days=delay_days,
        backorder_quantity=shortfall,
        backorder_value=backorder_value,
        inventory_available=avail,
        inventory_incoming=inc,
        days_to_required=days_to_required,
        reasons=reasons,
    )


def commitment_risk() -> list[CommitmentRisk]:
    available = _available_by_product()
    incoming = _incoming_by_product()
    unit_values = _unit_value_by_item()
    today = date.today()
    rank = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    risks = [_assess(c, available, incoming, unit_values, today) for c in list_commitments()]
    return sorted(risks, key=lambda r: rank.get(r.risk_level, 9))


def commitment_dashboard() -> CommitmentDashboard:
    commitments = list_commitments()
    risks = commitment_risk()
    if not commitments:
        return CommitmentDashboard()

    fill_rates = [round(c.delivered_quantity / c.ordered_quantity * 100, 1) for c in commitments if c.ordered_quantity]
    otif_count = sum(1 for r in risks if r.otif)
    return CommitmentDashboard(
        total_commitments=len(commitments),
        open_commitments=sum(1 for c in commitments if c.status in {"open", "partially_fulfilled"}),
        fulfilled_commitments=sum(1 for c in commitments if c.status == "fulfilled"),
        delayed_commitments=sum(1 for c in commitments if c.status == "delayed"),
        backordered_commitments=sum(1 for c in commitments if c.status == "backordered"),
        average_fill_rate_pct=round(sum(fill_rates) / len(fill_rates), 1) if fill_rates else None,
        otif_pct=round(otif_count / len(commitments) * 100, 1),
        total_backorder_value=round(sum(r.backorder_value for r in risks), 2),
        high_risk_commitments=sum(1 for r in risks if r.risk_level in {"High", "Critical"}),
    )
