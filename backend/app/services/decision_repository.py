"""Decision repository (Phase 2A).

Captures every meaningful business decision - why it was made, by whom, what was
expected, and what actually happened - so future intelligence engines can learn
from outcomes. Decision types are free-form (no hardcoded business list); the UI
supplies them. Every write is mirrored into the tamper-evident audit trail.
"""

from __future__ import annotations

from datetime import datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.decisions import Decision, DecisionOutcomeRequest, DecisionRequest


def _load() -> list[Decision]:
    return load_collection("decisions", lambda payload: Decision(**payload))


def _save(decisions: list[Decision]) -> None:
    save_collection("decisions", decisions, lambda decision: decision.decision_id)


def _next_id(existing: list[Decision]) -> str:
    numbers = [
        int(decision.decision_id.split("-")[-1])
        for decision in existing
        if decision.decision_id.startswith("DEC-") and decision.decision_id.split("-")[-1].isdigit()
    ]
    return f"DEC-{(max(numbers) + 1) if numbers else 1:04d}"


def record_decision(request: DecisionRequest) -> Decision:
    if not request.decision_type.strip() or not request.reason.strip():
        raise ValueError("A decision needs a type and a reason.")

    decisions = _load()
    decision = Decision(
        decision_id=_next_id(decisions),
        decision_type=request.decision_type.strip(),
        reason=request.reason.strip(),
        user=request.user,
        role=request.role,
        decided_at=datetime.now().isoformat(),
        related_product=request.related_product,
        related_batch=request.related_batch,
        related_shipment=request.related_shipment,
        related_customer=request.related_customer,
        related_supplier=request.related_supplier,
        expected_outcome=request.expected_outcome,
        actual_outcome=None,
        status=request.status or "open",
    )
    _save([decision, *decisions])
    record_audit_event(
        action="decision",
        module_name="decisions",
        entity_name="decision",
        entity_id=decision.decision_id,
        actor=request.user,
        new_value=decision,
    )
    return decision


def list_decisions(
    decision_type: str | None = None,
    status: str | None = None,
    related_shipment: str | None = None,
) -> list[Decision]:
    decisions = _load()
    if decision_type:
        decisions = [d for d in decisions if d.decision_type.lower() == decision_type.lower()]
    if status:
        decisions = [d for d in decisions if d.status.lower() == status.lower()]
    if related_shipment:
        decisions = [d for d in decisions if (d.related_shipment or "").lower() == related_shipment.lower()]
    return sorted(decisions, key=lambda d: d.decided_at, reverse=True)


def get_decision(decision_id: str) -> Decision | None:
    return next((d for d in _load() if d.decision_id == decision_id), None)


def update_decision_outcome(decision_id: str, request: DecisionOutcomeRequest) -> Decision:
    decisions = _load()
    decision = next((d for d in decisions if d.decision_id == decision_id), None)
    if not decision:
        raise ValueError(f"Decision not found: {decision_id}")

    old_value = decision.model_copy()
    decision.actual_outcome = request.actual_outcome
    decision.status = request.status
    _save(decisions)
    record_audit_event(
        action="decision_outcome",
        module_name="decisions",
        entity_name="decision",
        entity_id=decision_id,
        actor=request.actor,
        old_value=old_value,
        new_value=decision,
    )
    return decision
