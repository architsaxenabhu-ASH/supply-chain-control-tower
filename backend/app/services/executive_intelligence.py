"""Executive intelligence (Phase 3C): the executive action queue (P9), the
executive decision engine (P10), and the v2 command center (P11).

Pure composition over the existing engines (expiry, reservations, allocations,
demand, shipments, financial, fulfillment, approvals). Recommendations only.
"""

from __future__ import annotations

from app.schemas.executive import (
    DistributorScoreRow,
    ExecutiveAction,
    ExecutiveCommandCenterV2,
    ExecutiveDecision,
)
from app.services.approval_repository import list_approvals, pending_approval_count
from app.services.commercial_intelligence import distributor_health
from app.services.commitment_integration import inventory_commitment
from app.services.demand_intelligence import demand_gap
from app.services.financial_intelligence import credit_control, distributor_financial_intelligence, payment_risk
from app.services.fulfillment_intelligence import commercial_readiness
from app.services.reservation_intelligence import reservation_risk
from app.services.release_repository import available_not_sellable
from app.services.shipment_intelligence import shipment_intelligence
from app.services.warehouse_repository import list_inventory_batches

SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}
EMERGENCY_PRIORITIES = {"emergency", "urgent", "critical"}


# --- P9 executive action queue ------------------------------------------

def executive_actions(severity: str | None = None) -> list[ExecutiveAction]:
    actions: list[ExecutiveAction] = []

    for batch in list_inventory_batches():
        record = f"{batch.item_code}/{batch.batch_number}"
        if batch.days_to_expiry < 0:
            actions.append(ExecutiveAction(action_type="expiry_risk", severity="critical", reference=record, title=f"{record} expired", source="inventory"))
        elif batch.days_to_expiry < 90:
            actions.append(ExecutiveAction(action_type="expiry_risk", severity="high", reference=record, title=f"{record} expires in {batch.days_to_expiry} day(s)", source="inventory"))

    for risk in payment_risk():
        if risk.risk_level in {"Critical", "High"}:
            actions.append(ExecutiveAction(action_type="payment_risk", severity=risk.risk_level.lower(), reference=risk.distributor, title=f"{risk.distributor} payment risk: {risk.risk_level}", detail="; ".join(risk.reasons), source="receivables"))

    for gap in demand_gap():
        if gap.shortage > 0:
            actions.append(ExecutiveAction(action_type="inventory_shortage", severity="high", reference=gap.item_code, title=f"{gap.item_code} short by {gap.shortage:g}", source="demand"))

    for control in credit_control():
        if control.status == "blocked":
            actions.append(ExecutiveAction(action_type="credit_hold", severity="high", reference=control.distributor, title=f"{control.distributor} credit blocked", detail=f"exposure {control.outstanding_exposure:g} vs limit {control.credit_limit:g}", source="credit_control"))

    for risk in reservation_risk():
        if risk.risk_level in {"Critical", "High"}:
            actions.append(ExecutiveAction(action_type="reservation_risk", severity=risk.risk_level.lower(), reference=risk.reservation_id, title=f"{risk.reservation_id} reservation risk: {risk.risk_level}", detail="; ".join(risk.reasons), source="reservations"))

    for insight in shipment_intelligence():
        if insight.is_delayed:
            actions.append(ExecutiveAction(action_type="delayed_shipment", severity="high" if insight.delay_days >= 7 else "medium", reference=insight.import_file_number, title=f"{insight.import_file_number} delayed {insight.delay_days} day(s)", detail=insight.delay_category, source="shipments"))

    not_sellable = available_not_sellable()
    if not_sellable:
        actions.append(ExecutiveAction(action_type="reallocation_candidate", severity="medium", reference=None, title=f"{len(not_sellable)} batch(es) available but not sellable", source="release"))

    for approval in list_approvals(outcome="pending"):
        actions.append(ExecutiveAction(action_type="pending_approval", severity="medium", reference=approval.approval_id, title=f"Pending {approval.approval_type} approval", detail=approval.reason, source="approvals"))

    if severity:
        actions = [a for a in actions if a.severity == severity.lower()]
    return sorted(actions, key=lambda a: SEVERITY_RANK.get(a.severity, 9))


# --- P10 executive decision engine --------------------------------------

def executive_decisions() -> list[ExecutiveDecision]:
    decisions: list[ExecutiveDecision] = []
    today_batches = list_inventory_batches()

    expired = [b for b in today_batches if b.days_to_expiry < 0]
    near = [b for b in today_batches if 0 <= b.days_to_expiry < 90]
    if expired or near:
        decisions.append(
            ExecutiveDecision(
                risk_domain="expiry",
                priority="critical" if expired else "high",
                business_impact=f"{len(expired)} expired and {len(near)} batches expiring within 90 days risk write-off",
                recommended_action="Prioritise dispatch/reallocation of soonest-expiring batches to high-consumption distributors",
                supporting_data={"expired": len(expired), "expiring_90": len(near)},
            )
        )

    for risk in payment_risk():
        if risk.risk_level in {"Critical", "High"}:
            decisions.append(
                ExecutiveDecision(
                    risk_domain="payment",
                    priority=risk.risk_level.lower(),
                    business_impact=f"{risk.distributor} has {risk.past_due_amount:g} past due ({risk.past_due_days} days)",
                    recommended_action="Hold further credit shipments and escalate collection",
                    supporting_data={"distributor": risk.distributor, "past_due_amount": risk.past_due_amount, "past_due_days": risk.past_due_days},
                )
            )

    for health in distributor_health():
        if health.category in {"High Expiry Risk", "Underperformer"}:
            decisions.append(
                ExecutiveDecision(
                    risk_domain="distributor",
                    priority="high" if health.category == "High Expiry Risk" else "medium",
                    business_impact=f"{health.distributor} is a {health.category} (score {health.health_score})",
                    recommended_action="Review allocations; redirect stock to stronger consumers" if health.category == "High Expiry Risk" else "Engage distributor to lift utilisation",
                    supporting_data={"distributor": health.distributor, "health_score": health.health_score, "category": health.category},
                )
            )

    for gap in demand_gap():
        if gap.shortage > 0:
            decisions.append(
                ExecutiveDecision(
                    risk_domain="demand",
                    priority="high",
                    business_impact=f"{gap.item_code} short by {gap.shortage:g} against demand",
                    recommended_action="Expedite inbound supply or reallocate available stock",
                    supporting_data={"item_code": gap.item_code, "shortage": gap.shortage, "coverage_pct": gap.coverage_pct},
                )
            )

    delayed = [s for s in shipment_intelligence() if s.is_delayed]
    if delayed:
        decisions.append(
            ExecutiveDecision(
                risk_domain="shipment",
                priority="high",
                business_impact=f"{len(delayed)} shipment(s) delayed",
                recommended_action="Escalate with carrier/customs and record root cause",
                supporting_data={"delayed": len(delayed)},
            )
        )

    commitment = inventory_commitment()
    if commitment.expired_inventory or commitment.blocked_inventory:
        decisions.append(
            ExecutiveDecision(
                risk_domain="inventory",
                priority="medium",
                business_impact=f"{commitment.expired_inventory:g} expired + {commitment.blocked_inventory:g} blocked units locked",
                recommended_action="Dispose expired and review blocked stock for release",
                supporting_data={"expired": commitment.expired_inventory, "blocked": commitment.blocked_inventory},
            )
        )

    return sorted(decisions, key=lambda d: SEVERITY_RANK.get(d.priority, 9))


# --- P11 executive command center v2 ------------------------------------

def executive_command_center_v2() -> ExecutiveCommandCenterV2:
    commitment = inventory_commitment()
    financial = distributor_financial_intelligence()
    risks = {r.distributor: r for r in payment_risk()}
    health_rows = {h.distributor: h for h in distributor_health()}
    readiness = commercial_readiness()

    outstanding = sum(f.outstanding_amount for f in financial)
    past_due = sum(f.past_due_amount for f in financial)
    top_overdue = [f.distributor for f in sorted(financial, key=lambda f: -f.past_due_amount) if f.past_due_amount > 0][:5]

    at_risk_value = sum(b.inventory_value for b in list_inventory_batches() if b.days_to_expiry < 182)
    not_sellable = sum(b.quantity for b in available_not_sellable())

    ready = sum(1 for r in readiness if r.status == "Ready")
    blocked_payment = sum(1 for r in readiness if r.status == "Waiting Payment")
    blocked_inventory = sum(1 for r in readiness if r.status == "Waiting Inventory")
    blocked_release = sum(1 for r in readiness if r.status == "Waiting Release")

    # Distributor scorecards: combine financial, sales (utilisation), expiry, health.
    distributor_names = set(health_rows) | set(risks)
    score_rows: list[DistributorScoreRow] = []
    payment_score = {"Low": 90.0, "Medium": 60.0, "High": 35.0, "Critical": 10.0}
    for distributor in sorted(distributor_names):
        health = health_rows.get(distributor)
        risk = risks.get(distributor)
        score_rows.append(
            DistributorScoreRow(
                distributor=distributor,
                financial_score=payment_score.get(risk.risk_level) if risk else None,
                sales_score=health.allocation_utilization_pct if health else None,
                expiry_score=health.expiry_performance if health else None,
                health_score=health.health_score if health else None,
            )
        )

    actions = executive_actions()
    critical_actions = sum(1 for a in actions if a.severity == "critical")

    return ExecutiveCommandCenterV2(
        outstanding_receivables=round(outstanding, 2),
        past_due_amount=round(past_due, 2),
        credit_exposure=round(outstanding, 2),
        top_overdue_distributors=top_overdue,
        inventory_value=round(commitment.physical_value, 2),
        inventory_at_risk=round(at_risk_value, 2),
        available_inventory=commitment.available_inventory,
        reserved_inventory=commitment.reserved_inventory,
        allocated_inventory=commitment.allocated_inventory,
        not_sellable_inventory=not_sellable,
        orders_ready_to_ship=ready,
        orders_blocked_by_payment=blocked_payment,
        orders_blocked_by_inventory=blocked_inventory,
        orders_blocked_by_release=blocked_release,
        distributor_scores=score_rows[:10],
        pending_approvals=pending_approval_count(),
        critical_actions=critical_actions,
        escalations=critical_actions + blocked_payment,
    )
