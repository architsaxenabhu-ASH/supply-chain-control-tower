"""Distributor financial intelligence (P2), payment risk (P3), and credit
control (P7). All rules-based and derived from the receivables + credit-limit
stores - transparent, explainable, no AI."""

from __future__ import annotations

from collections import defaultdict
from datetime import date

from app.schemas.receivables import (
    CreditControl,
    DistributorFinancialScorecard,
    PaymentRisk,
)
from app.services.receivables_repository import get_credit_limit, list_receivables


def _past_due_days(records, today: date) -> int:
    worst = 0
    for record in records:
        if record.status == "overdue":
            try:
                worst = max(worst, (today - date.fromisoformat(record.due_date)).days)
            except ValueError:
                continue
    return worst


def _average_collection_days(records) -> float | None:
    spans: list[int] = []
    for record in records:
        if record.status == "paid" and record.payment_history:
            try:
                last_paid = max(date.fromisoformat(p.paid_date) for p in record.payment_history)
                spans.append((last_paid - date.fromisoformat(record.invoice_date)).days)
            except ValueError:
                continue
    return round(sum(spans) / len(spans), 1) if spans else None


def _payment_trend(outstanding: float, past_due: float, past_due_days: int) -> str:
    if outstanding <= 0:
        return "stable"
    ratio = past_due / outstanding if outstanding else 0
    if ratio >= 0.5 or past_due_days > 60:
        return "worsening"
    if ratio >= 0.15 or past_due_days > 0:
        return "stable"
    return "improving"


def _by_distributor() -> dict[str, list]:
    grouped: dict[str, list] = defaultdict(list)
    for record in list_receivables():
        grouped[record.distributor].append(record)
    return grouped


def distributor_financial_intelligence() -> list[DistributorFinancialScorecard]:
    today = date.today()
    cards: list[DistributorFinancialScorecard] = []
    for distributor, records in sorted(_by_distributor().items()):
        outstanding = sum(r.outstanding_value for r in records)
        past_due = sum(r.outstanding_value for r in records if r.status == "overdue")
        past_due_days = _past_due_days(records, today)
        cards.append(
            DistributorFinancialScorecard(
                distributor=distributor,
                outstanding_amount=round(outstanding, 2),
                past_due_amount=round(past_due, 2),
                past_due_days=past_due_days,
                average_collection_days=_average_collection_days(records),
                credit_exposure=round(outstanding, 2),
                payment_trend=_payment_trend(outstanding, past_due, past_due_days),
                invoice_count=len(records),
            )
        )
    return cards


def payment_risk() -> list[PaymentRisk]:
    rank = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    results: list[PaymentRisk] = []
    for card in distributor_financial_intelligence():
        reasons: list[str] = []
        if card.past_due_days > 90:
            level = "Critical"
            reasons.append(f"{card.past_due_days} days past due")
        elif card.past_due_days > 45 or (card.payment_trend == "worsening" and card.past_due_amount > 0):
            level = "High"
            reasons.append("Significant overdue balance / worsening trend")
        elif card.past_due_amount > 0:
            level = "Medium"
            reasons.append("Some balance past due")
        elif card.outstanding_amount > 0:
            level = "Low"
            reasons.append("Outstanding balance within terms")
        else:
            level = "Low"
            reasons.append("No outstanding balance")
        if card.past_due_amount > 0:
            reasons.append(f"Past due amount {card.past_due_amount:g}")
        results.append(
            PaymentRisk(
                distributor=card.distributor,
                risk_level=level,
                outstanding_amount=card.outstanding_amount,
                past_due_amount=card.past_due_amount,
                past_due_days=card.past_due_days,
                payment_trend=card.payment_trend,
                reasons=reasons,
            )
        )
    return sorted(results, key=lambda r: rank.get(r.risk_level, 9))


def credit_control() -> list[CreditControl]:
    today = date.today()
    results: list[CreditControl] = []
    for distributor, records in sorted(_by_distributor().items()):
        outstanding = sum(r.outstanding_value for r in records)
        overdue = sum(r.outstanding_value for r in records if r.status == "overdue")
        limit_record = get_credit_limit(distributor)
        credit_limit = limit_record.credit_limit if limit_record else 0
        override = limit_record.override if limit_record else False
        available = round(credit_limit - outstanding, 2)

        if override:
            status = "healthy"
        elif credit_limit > 0 and outstanding > credit_limit:
            status = "blocked"
        elif overdue > 0 or (credit_limit > 0 and outstanding > 0.8 * credit_limit):
            status = "warning"
        else:
            status = "healthy"

        results.append(
            CreditControl(
                distributor=distributor,
                credit_limit=round(credit_limit, 2),
                outstanding_exposure=round(outstanding, 2),
                available_credit=available,
                overdue_amount=round(overdue, 2),
                status=status,
                override=override,
            )
        )
    return results


def credit_status_for(distributor: str) -> CreditControl | None:
    return next((c for c in credit_control() if c.distributor.lower() == distributor.lower()), None)
