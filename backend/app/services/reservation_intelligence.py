"""Reservation intelligence (Phase 2C): consumption tracking (P2), risk (P3),
customer scorecards (P5), and the commitment dashboard (P6). All rules-based and
derived from the reservation store + inventory (batch expiry and unit value)."""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.schemas.reservations import (
    CommitmentDashboard,
    CustomerConsumptionScorecard,
    ReservationConsumption,
    ReservationRisk,
)
from app.services.reservation_repository import EXPIRING_SOON_DAYS, _days_until_expiry, list_reservations
from app.services.warehouse_repository import list_inventory_batches

NEAR_BATCH_EXPIRY_DAYS = 90
LIVE_STATUSES = {"active", "expiring_soon", "expired", "approved"}


def _batch_expiry_map() -> dict[tuple[str, str], int]:
    return {
        (batch.item_code.lower(), batch.batch_number.lower()): batch.days_to_expiry
        for batch in list_inventory_batches()
    }


def _unit_value_map() -> dict[tuple[str, str], float]:
    values: dict[tuple[str, str], float] = {}
    for batch in list_inventory_batches():
        quantity = batch.quantity_available or 0
        unit = batch.inventory_value / quantity if quantity else 0
        values[(batch.item_code.lower(), batch.batch_number.lower())] = unit
    return values


def reservation_consumption() -> list[ReservationConsumption]:
    today = date.today()
    result: list[ReservationConsumption] = []
    for reservation in list_reservations():
        reserved = reservation.quantity
        consumed = reservation.consumed_quantity
        remaining = reserved - consumed
        pct = round(consumed / reserved * 100, 1) if reserved else 0.0
        days_since = (today - date.fromisoformat(reservation.reservation_date)).days
        days_until = _days_until_expiry(reservation, today)
        rate = round(consumed / days_since, 2) if days_since > 0 else None
        result.append(
            ReservationConsumption(
                reservation_id=reservation.reservation_id,
                customer=reservation.customer,
                item_code=reservation.item_code,
                batch_number=reservation.batch_number,
                reserved_quantity=reserved,
                consumed_quantity=consumed,
                remaining_quantity=remaining,
                consumption_pct=pct,
                utilization_pct=pct,
                consumption_rate_per_day=rate,
                days_since_reservation=days_since,
                days_until_expiry=days_until,
                effective_status=reservation.effective_status,
            )
        )
    return result


def _score(days_remaining, consumption_pct, batch_days, remaining):
    reasons: list[str] = []
    expiry_risk = days_remaining <= EXPIRING_SOON_DAYS and consumption_pct < 1.0 and remaining > 0
    driven_risk = batch_days is not None and batch_days <= NEAR_BATCH_EXPIRY_DAYS and remaining > 0 and consumption_pct < 1.0

    if days_remaining < 0:
        level = "Critical"
        reasons.append("Reservation has expired")
    elif batch_days is not None and batch_days <= days_remaining and consumption_pct < 0.5 and remaining > 0:
        level = "Critical"
        reasons.append("Batch will expire while reserved and under-consumed")
    elif days_remaining <= 5 and consumption_pct < 0.5:
        level = "Critical"
        reasons.append("Expires within 5 days and under-consumed")
    elif days_remaining <= EXPIRING_SOON_DAYS and consumption_pct < 0.5:
        level = "High"
        reasons.append("Expiring soon with low consumption")
    elif driven_risk and batch_days is not None and batch_days <= NEAR_BATCH_EXPIRY_DAYS:
        level = "High"
        reasons.append("Reserved batch nearing expiry")
    elif days_remaining <= 30 and consumption_pct < 0.75:
        level = "Medium"
        reasons.append("Moderate time pressure and consumption gap")
    else:
        level = "Low"
    return level, expiry_risk, driven_risk, reasons


def reservation_risk() -> list[ReservationRisk]:
    batch_expiry = _batch_expiry_map()
    today = date.today()
    rank = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    result: list[ReservationRisk] = []
    for reservation in list_reservations():
        if reservation.effective_status not in LIVE_STATUSES:
            continue
        reserved = reservation.quantity
        consumed = reservation.consumed_quantity
        remaining = reserved - consumed
        consumption_pct = consumed / reserved if reserved else 0.0
        days_remaining = _days_until_expiry(reservation, today)
        batch_days = batch_expiry.get((reservation.item_code.lower(), reservation.batch_number.lower()))
        level, expiry_risk, driven_risk, reasons = _score(days_remaining, consumption_pct, batch_days, remaining)
        result.append(
            ReservationRisk(
                reservation_id=reservation.reservation_id,
                customer=reservation.customer,
                item_code=reservation.item_code,
                batch_number=reservation.batch_number,
                risk_level=level,
                days_remaining=days_remaining,
                consumption_pct=round(consumption_pct * 100, 1),
                quantity_remaining=remaining,
                batch_days_to_expiry=batch_days,
                reservation_expiry_risk=expiry_risk,
                reservation_driven_expiry_risk=driven_risk,
                reasons=reasons,
            )
        )
    return sorted(result, key=lambda r: rank.get(r.risk_level, 9))


def customer_consumption() -> list[CustomerConsumptionScorecard]:
    by_customer: dict[str, list] = defaultdict(list)
    for reservation in list_reservations():
        by_customer[reservation.customer].append(reservation)

    scorecards: list[CustomerConsumptionScorecard] = []
    for customer, reservations in sorted(by_customer.items()):
        reserved = sum(r.quantity for r in reservations)
        consumed = sum(r.consumed_quantity for r in reservations)
        consumption_times = [
            (date.fromisoformat(r.consumed_date) - date.fromisoformat(r.reservation_date)).days
            for r in reservations
            if r.consumed_date
        ]
        scorecards.append(
            CustomerConsumptionScorecard(
                customer=customer,
                reservation_count=len(reservations),
                utilization_pct=round(consumed / reserved * 100, 1) if reserved else None,
                average_consumption_days=round(sum(consumption_times) / len(consumption_times), 1)
                if consumption_times
                else None,
                expired_reservations=sum(1 for r in reservations if r.effective_status == "expired"),
                reallocated_reservations=sum(1 for r in reservations if r.status == "reallocated"),
            )
        )
    return scorecards


def commitment_dashboard() -> CommitmentDashboard:
    reservations = list_reservations()
    risks = reservation_risk()
    unit_values = _unit_value_map()
    today = date.today()

    live = [r for r in reservations if r.effective_status in {"active", "expiring_soon"}]
    expiring_15 = [r for r in live if 0 <= _days_until_expiry(r, today) <= 15]
    expiring_5 = [r for r in live if 0 <= _days_until_expiry(r, today) <= 5]
    high_risk = [r for r in risks if r.risk_level in {"High", "Critical"}]

    reallocation_candidates = [
        r
        for r in reservations
        if r.effective_status in {"expiring_soon", "expired"}
        and (r.quantity == 0 or r.consumed_quantity / r.quantity < 0.5)
    ]

    value_at_risk = 0.0
    for reservation in reservations:
        if reservation.effective_status in {"expiring_soon", "expired"}:
            remaining = reservation.quantity - reservation.consumed_quantity
            unit = unit_values.get((reservation.item_code.lower(), reservation.batch_number.lower()), 0)
            value_at_risk += remaining * unit

    return CommitmentDashboard(
        active_reservations=len(live),
        expiring_within_15_days=len(expiring_15),
        expiring_within_5_days=len(expiring_5),
        high_risk_reservations=len(high_risk),
        reallocation_candidates=len(reallocation_candidates),
        reservation_value_at_risk=round(value_at_risk, 2),
    )
