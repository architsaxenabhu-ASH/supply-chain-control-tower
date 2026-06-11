"""Partner intelligence (Phase 3D): partner financial scorecards (P2), payables
risk (P3), logistics (P4) / customs (P5) / warehouse (P6) partner performance,
and the v3 executive command center (P7).

Reuses the financial-intelligence framework and existing carrier, import
lifecycle, document, and inventory-count engines. No new models beyond payables.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.schemas.partners import (
    CustomsPartnerIntelligence,
    ExecutiveCommandCenterV3,
    LogisticsPartnerScorecard,
    WarehousePartnerScorecard,
)
from app.schemas.payables import PartnerFinancialScorecard, PayablesRisk
from app.services.business_intelligence import _candidate_document_ids, carrier_intelligence
from app.services.document_readiness import document_readiness
from app.services.executive_intelligence import executive_command_center_v2
from app.services.financial_intelligence import distributor_financial_intelligence, payment_risk
from app.services.import_repository import get_shipment_timeline, list_import_candidates
from app.services.local_document_store import list_saved_documents
from app.services.payables_repository import list_payables
from app.services.warehouse_repository import list_goods_receipts, list_inventory_batches, list_inventory_counts

UPCOMING_DUE_DAYS = 30
CLEARED_STATUSES = {"arrived", "goods_receipt_pending", "received", "closed"}
OPEN_CUSTOMS_STATUSES = {"customs_in_progress", "country_documents_pending"}
DEPENDENCY_THRESHOLD = 40.0


def _by_partner() -> dict[str, list]:
    grouped: dict[str, list] = defaultdict(list)
    for record in list_payables():
        grouped[record.partner_name].append(record)
    return grouped


# --- P2 partner financial intelligence ----------------------------------

def partner_financial_intelligence() -> list[PartnerFinancialScorecard]:
    today = date.today()
    cards: list[PartnerFinancialScorecard] = []
    for partner, records in sorted(_by_partner().items()):
        outstanding = sum(r.outstanding_value for r in records)
        past_due = sum(r.outstanding_value for r in records if r.status == "overdue")
        spans: list[int] = []
        upcoming = 0.0
        for record in records:
            if record.status == "paid" and record.payment_history:
                try:
                    last_paid = max(date.fromisoformat(p.paid_date) for p in record.payment_history)
                    spans.append((last_paid - date.fromisoformat(record.invoice_date)).days)
                except ValueError:
                    pass
            if record.status in {"open", "partially_paid"}:
                try:
                    days = (date.fromisoformat(record.due_date) - today).days
                    if 0 <= days <= UPCOMING_DUE_DAYS:
                        upcoming += record.outstanding_value
                except ValueError:
                    pass
        cards.append(
            PartnerFinancialScorecard(
                partner_name=partner,
                partner_type=records[0].partner_type,
                outstanding_payables=round(outstanding, 2),
                past_due_payables=round(past_due, 2),
                average_payment_days=round(sum(spans) / len(spans), 1) if spans else None,
                upcoming_due_payments=round(upcoming, 2),
                partner_exposure=round(outstanding, 2),
                invoice_count=len(records),
            )
        )
    return cards


# --- P3 payables risk ---------------------------------------------------

def _days_to_next_due(records, today: date) -> int | None:
    days = []
    for record in records:
        if record.status in {"open", "partially_paid", "overdue"}:
            try:
                days.append((date.fromisoformat(record.due_date) - today).days)
            except ValueError:
                continue
    return min(days) if days else None


def payables_risk() -> list[PayablesRisk]:
    today = date.today()
    grouped = _by_partner()
    total_outstanding = sum(r.outstanding_value for records in grouped.values() for r in records) or 1.0
    rank = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}

    results: list[PayablesRisk] = []
    for partner, records in sorted(grouped.items()):
        outstanding = sum(r.outstanding_value for r in records)
        past_due = sum(r.outstanding_value for r in records if r.status == "overdue")
        dependency = outstanding / total_outstanding * 100
        days_next = _days_to_next_due(records, today)
        reasons: list[str] = []

        if past_due > 0 and dependency >= DEPENDENCY_THRESHOLD:
            level = "Critical"
            reasons.append("Large past-due balance with high partner dependency")
        elif past_due > 0:
            level = "High"
            reasons.append("Past-due payables")
        elif days_next is not None and days_next <= 7 and outstanding > 0:
            level = "High"
            reasons.append("Payment due within 7 days")
        elif outstanding > 0:
            level = "Medium" if dependency >= DEPENDENCY_THRESHOLD else "Low"
            reasons.append("Outstanding within terms")
        else:
            level = "Low"
            reasons.append("No outstanding payables")
        if dependency >= DEPENDENCY_THRESHOLD:
            reasons.append(f"{dependency:.0f}% of total payables")

        results.append(
            PayablesRisk(
                partner_name=partner,
                partner_type=records[0].partner_type,
                risk_level=level,
                outstanding_amount=round(outstanding, 2),
                past_due_amount=round(past_due, 2),
                days_to_next_due=days_next,
                dependency_pct=round(dependency, 1),
                reasons=reasons,
            )
        )
    return sorted(results, key=lambda r: rank.get(r.risk_level, 9))


# --- P4 logistics partner intelligence ----------------------------------

def _carrier_doc_accuracy() -> dict[str, float]:
    documents = {d.document_id: d for d in list_saved_documents()}
    by_carrier: dict[str, list[float]] = defaultdict(list)
    for candidate in list_import_candidates():
        if not candidate.carrier_name:
            continue
        for doc_id in _candidate_document_ids(candidate):
            doc = documents.get(doc_id)
            if doc and doc.required_field_count > 0:
                by_carrier[candidate.carrier_name].append((doc.required_field_count - doc.missing_required_count) / doc.required_field_count)
    return {carrier: round(sum(v) / len(v) * 100, 1) for carrier, v in by_carrier.items() if v}


def logistics_partner_intelligence() -> list[LogisticsPartnerScorecard]:
    doc_accuracy = _carrier_doc_accuracy()
    cost = defaultdict(float)
    for payable in list_payables():
        if payable.partner_type in {"3pl", "freight_forwarder"}:
            cost[payable.partner_name.lower()] += payable.outstanding_value

    cards: list[LogisticsPartnerScorecard] = []
    for carrier in carrier_intelligence():
        cards.append(
            LogisticsPartnerScorecard(
                partner=carrier.carrier,
                shipments_managed=carrier.shipment_count,
                average_transit_days=carrier.average_transit_days,
                delay_pct=round(100 - carrier.on_time_pct, 1) if carrier.on_time_pct is not None else None,
                delay_days=carrier.delay_days,
                documentation_accuracy_pct=doc_accuracy.get(carrier.carrier),
                cost_exposure=round(cost.get(carrier.carrier.lower(), 0), 2),
            )
        )
    return cards


# --- P5 customs partner intelligence ------------------------------------

def customs_partner_intelligence() -> CustomsPartnerIntelligence:
    candidates = list_import_candidates()
    receipts = {r.grn_number: r for r in list_goods_receipts()}
    readiness = {r.import_file_number: r for r in document_readiness()}

    cleared = [c for c in candidates if c.status.value in CLEARED_STATUSES]
    clearance: list[int] = []
    for candidate in cleared:
        receipt = receipts.get(f"GRN-{candidate.import_file_number}")
        if candidate.flight_date and receipt:
            clearance.append((receipt.receipt_date - candidate.flight_date).days)

    late = total = 0
    for candidate in candidates:
        total += 1
        if get_shipment_timeline(candidate.import_file_number).late_count > 0:
            late += 1

    doc_issues = sum(
        1
        for c in candidates
        if (readiness.get(c.import_file_number) and readiness[c.import_file_number].missing_documents) or c.extraction_warnings
    )
    open_cases = sum(1 for c in candidates if c.status.value in OPEN_CUSTOMS_STATUSES)

    broker_cost: dict[str, float] = defaultdict(float)
    for payable in list_payables(partner_type="customs_broker"):
        broker_cost[payable.partner_name] += payable.outstanding_value

    return CustomsPartnerIntelligence(
        shipments_cleared=len(cleared),
        average_clearance_days=round(sum(clearance) / len(clearance), 1) if clearance else None,
        delay_pct=round(late / total * 100, 1) if total else None,
        documentation_issues=doc_issues,
        open_cases=open_cases,
        broker_cost_exposure={k: round(v, 2) for k, v in broker_cost.items()},
    )


# --- P6 warehouse partner intelligence ----------------------------------

def warehouse_partner_intelligence() -> list[WarehousePartnerScorecard]:
    inventory_qty: dict[str, float] = defaultdict(float)
    inventory_value: dict[str, float] = defaultdict(float)
    for batch in list_inventory_batches():
        inventory_qty[batch.warehouse_location] += batch.quantity_available
        inventory_value[batch.warehouse_location] += batch.inventory_value

    variance: dict[str, float] = defaultdict(float)
    system: dict[str, float] = defaultdict(float)
    issues: dict[str, int] = defaultdict(int)
    for count in list_inventory_counts():
        for line in count.lines:
            variance[count.warehouse] += abs(line.variance_quantity)
            system[count.warehouse] += line.system_quantity
            if line.variance_quantity != 0:
                issues[count.warehouse] += 1

    warehouses = set(inventory_qty) | set(variance)
    cards: list[WarehousePartnerScorecard] = []
    for warehouse in sorted(w for w in warehouses if w):
        accuracy = None
        if system.get(warehouse):
            accuracy = max(0.0, min(100.0, round((1 - variance[warehouse] / system[warehouse]) * 100, 1)))
        cards.append(
            WarehousePartnerScorecard(
                warehouse=warehouse,
                inventory_managed=inventory_qty.get(warehouse, 0),
                inventory_accuracy_pct=accuracy,
                inventory_value=round(inventory_value.get(warehouse, 0), 2),
                cycle_count_variance=round(variance.get(warehouse, 0), 2),
                open_issues=issues.get(warehouse, 0),
            )
        )
    return cards


# --- P7 executive command center v3 -------------------------------------

def executive_command_center_v3() -> ExecutiveCommandCenterV3:
    receivables_outstanding = sum(f.outstanding_amount for f in distributor_financial_intelligence())
    payables_outstanding = sum(c.outstanding_payables for c in partner_financial_intelligence())
    logistics = logistics_partner_intelligence()
    customs = customs_partner_intelligence()
    warehouse = warehouse_partner_intelligence()

    payment_risk_count = sum(1 for r in payment_risk() if r.risk_level in {"High", "Critical"})
    payables_risk_count = sum(1 for r in payables_risk() if r.risk_level in {"High", "Critical"})
    partner_risk_count = (
        sum(1 for l in logistics if (l.delay_pct or 0) >= 25)
        + (1 if customs.open_cases else 0)
        + sum(1 for w in warehouse if w.open_issues > 0)
    )

    return ExecutiveCommandCenterV3(
        receivables_outstanding=round(receivables_outstanding, 2),
        payables_outstanding=round(payables_outstanding, 2),
        net_exposure=round(receivables_outstanding - payables_outstanding, 2),
        logistics_partner_performance=logistics[:5],
        customs_partner_performance=customs,
        warehouse_partner_performance=warehouse[:5],
        payment_risk_count=payment_risk_count,
        payables_risk_count=payables_risk_count,
        partner_risk_count=partner_risk_count,
        command_center_v2=executive_command_center_v2(),
    )
