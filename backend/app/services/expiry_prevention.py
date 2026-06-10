"""Expiry Prevention Engine (Phase 2B, P5).

Month-based expiry buckets (< 6m, 6-12m, 12-24m, > 24m) that supersede the old
day-based buckets for medical-device shelf-life management, plus a per-batch
risk score, value of inventory at risk, and the soonest-expiring products and
batches. (The Phase 1 day-bucket dashboard endpoints remain for backward
compatibility.)"""

from __future__ import annotations

from app.schemas.operational_intelligence import (
    ExpiryPrevention,
    ExpiryPreventionBuckets,
    ExpiryRiskBatch,
)
from app.services.warehouse_repository import list_inventory_batches

SIX_MONTHS = 182
TWELVE_MONTHS = 365
TWENTY_FOUR_MONTHS = 730


def _risk_score(days_to_expiry: int) -> int:
    if days_to_expiry < 0:
        return 100
    if days_to_expiry < SIX_MONTHS:
        return 80
    if days_to_expiry < TWELVE_MONTHS:
        return 50
    if days_to_expiry < TWENTY_FOUR_MONTHS:
        return 20
    return 5


def expiry_prevention() -> ExpiryPrevention:
    batches = list_inventory_batches()
    buckets = ExpiryPreventionBuckets()
    at_risk_value = 0.0
    scores: list[int] = []

    for batch in batches:
        days = batch.days_to_expiry
        scores.append(_risk_score(days))
        if days < 0:
            buckets.expired += 1
            at_risk_value += batch.inventory_value
        elif days < SIX_MONTHS:
            buckets.under_6_months += 1
            at_risk_value += batch.inventory_value
        elif days < TWELVE_MONTHS:
            buckets.months_6_12 += 1
        elif days < TWENTY_FOUR_MONTHS:
            buckets.months_12_24 += 1
        else:
            buckets.over_24_months += 1

    def risk_item(batch) -> ExpiryRiskBatch:
        return ExpiryRiskBatch(
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

    return ExpiryPrevention(
        buckets=buckets,
        inventory_at_risk_value=at_risk_value,
        average_risk_score=round(sum(scores) / len(scores), 1) if scores else 0,
        soonest_products=soonest_products,
        soonest_batches=soonest_batches,
    )
