"""Consignment Intelligence (Phase 4, P3): reconciliation, risk indicators, and
a recommended workflow action. Recommendations only - management decides whether
to verify, push sales, recall, or replace."""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.schemas.consignment import ConsignmentDashboard, ConsignmentReconciliation, ConsignmentRisk
from app.services.consignment_repository import list_consignments
from app.services.import_repository import list_import_candidates
from app.services.warehouse_repository import list_inventory_batches

AGING_DAYS = 90
NO_REPORT_DAYS = 30
LOW_CONSUMPTION_PCT = 30.0
EXPIRY_EXPOSURE_DAYS = 182


def _batch_expiry_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for batch in list_inventory_batches():
        if batch.expiry_date:
            mapping[batch.batch_number.lower()] = batch.expiry_date.isoformat()
    for candidate in list_import_candidates():
        for line in candidate.lines:
            if line.expiry_date and line.batch_number.lower() not in mapping:
                mapping[line.batch_number.lower()] = line.expiry_date.isoformat()
    return mapping


def consignment_reconciliation() -> list[ConsignmentReconciliation]:
    rows: list[ConsignmentReconciliation] = []
    for record in list_consignments():
        expected_remaining = max(record.quantity_sent - record.quantity_consumed, 0)
        discrepancy = round(expected_remaining - record.quantity_reported, 2)
        rows.append(
            ConsignmentReconciliation(
                consignment_id=record.consignment_id,
                distributor=record.distributor,
                material=record.material,
                batch_number=record.batch_number,
                quantity_sent=record.quantity_sent,
                quantity_consumed=record.quantity_consumed,
                expected_remaining=expected_remaining,
                reported_remaining=record.quantity_reported,
                discrepancy=discrepancy,
                last_report_date=record.last_report_date,
                reconciled=record.last_report_date is not None and abs(discrepancy) < 1e-6,
            )
        )
    return rows


def _recommended_action(no_report, low_consumption, expiry_exposure) -> str:
    if no_report:
        return "Verify Inventory Position"
    if expiry_exposure and low_consumption:
        return "Recall Inventory"
    if expiry_exposure:
        return "Recall Inventory"
    if low_consumption:
        return "Push Distributor Sales"
    return "Monitor"


def consignment_risk() -> list[ConsignmentRisk]:
    expiry_map = _batch_expiry_map()
    today = date.today()
    rank = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    risks: list[ConsignmentRisk] = []

    for record in list_consignments():
        try:
            days_since_sent = (today - date.fromisoformat(record.sent_date)).days
        except ValueError:
            days_since_sent = 0
        days_since_report = None
        if record.last_report_date:
            try:
                days_since_report = (today - date.fromisoformat(record.last_report_date)).days
            except ValueError:
                days_since_report = None

        consumption_pct = round(record.quantity_consumed / record.quantity_sent * 100, 1) if record.quantity_sent else 0
        days_to_expiry = None
        expiry_iso = expiry_map.get(record.batch_number.lower())
        if expiry_iso:
            try:
                days_to_expiry = (date.fromisoformat(expiry_iso) - today).days
            except ValueError:
                days_to_expiry = None

        no_report = record.last_report_date is None or (days_since_report is not None and days_since_report > NO_REPORT_DAYS)
        aging = days_since_sent > AGING_DAYS
        expiry_exposure = days_to_expiry is not None and days_to_expiry < EXPIRY_EXPOSURE_DAYS
        low_consumption = aging and consumption_pct < LOW_CONSUMPTION_PCT

        reasons: list[str] = []
        if no_report:
            reasons.append("No recent distributor report")
        if aging:
            reasons.append(f"Aging {days_since_sent} days at distributor")
        if expiry_exposure:
            reasons.append(f"Batch expiry exposure ({days_to_expiry} days)")
        if low_consumption:
            reasons.append(f"Low consumption ({consumption_pct}%)")

        if (expiry_exposure and low_consumption) or (days_to_expiry is not None and days_to_expiry < 0):
            level = "Critical"
        elif expiry_exposure or (no_report and aging):
            level = "High"
        elif no_report or low_consumption or aging:
            level = "Medium"
        else:
            level = "Low"
            if not reasons:
                reasons.append("Healthy consignment")

        risks.append(
            ConsignmentRisk(
                consignment_id=record.consignment_id,
                distributor=record.distributor,
                material=record.material,
                batch_number=record.batch_number,
                risk_level=level,
                days_since_sent=days_since_sent,
                days_since_report=days_since_report,
                consumption_pct=consumption_pct,
                days_to_expiry=days_to_expiry,
                no_report=no_report,
                aging=aging,
                expiry_exposure=expiry_exposure,
                low_consumption=low_consumption,
                recommended_action=_recommended_action(no_report, low_consumption, expiry_exposure),
                reasons=reasons,
            )
        )
    return sorted(risks, key=lambda r: rank.get(r.risk_level, 9))


def consignment_dashboard() -> ConsignmentDashboard:
    consignments = list_consignments()
    risks = consignment_risk()
    return ConsignmentDashboard(
        total_consignments=len(consignments),
        total_quantity_sent=sum(c.quantity_sent for c in consignments),
        total_remaining=sum(c.quantity_remaining for c in consignments),
        no_report_count=sum(1 for r in risks if r.no_report),
        aging_count=sum(1 for r in risks if r.aging),
        expiry_exposure_count=sum(1 for r in risks if r.expiry_exposure),
        low_consumption_count=sum(1 for r in risks if r.low_consumption),
        high_risk_count=sum(1 for r in risks if r.risk_level in {"High", "Critical"}),
    )
