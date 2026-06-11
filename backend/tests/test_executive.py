"""Phase 3C: management approvals, executive action queue, executive decisions,
and the v2 command center."""

import pytest

from app.schemas.executive import CreateApprovalRequest, DecideApprovalRequest
from app.services import approval_repository as ap
from app.services import executive_intelligence as ex

SEVERITY_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def test_approval_lifecycle_and_validation():
    approval = ap.create_approval(
        CreateApprovalRequest(approval_type="emergency_shipment", reference="SHP-X", reason="urgent", requestor="qa@example.com")
    )
    assert approval.outcome == "pending"
    decided = ap.decide_approval(approval.approval_id, DecideApprovalRequest(outcome="approved", approver="boss@example.com"))
    assert decided.outcome == "approved"
    assert decided.approver == "boss@example.com"
    with pytest.raises(ValueError):
        ap.create_approval(CreateApprovalRequest(approval_type="bogus", requestor="qa@example.com"))
    with pytest.raises(ValueError):
        ap.decide_approval(approval.approval_id, DecideApprovalRequest(outcome="maybe", approver="boss@example.com"))


def test_executive_actions_sorted_and_filterable():
    actions = ex.executive_actions()
    ranks = [SEVERITY_RANK.get(a.severity, 9) for a in actions]
    assert ranks == sorted(ranks)
    highs = ex.executive_actions(severity="high")
    assert all(a.severity == "high" for a in highs)


def test_executive_decisions_have_valid_priorities():
    for decision in ex.executive_decisions():
        assert decision.priority in {"critical", "high", "medium", "low"}
        assert decision.recommended_action
        assert decision.risk_domain in {"inventory", "distributor", "payment", "shipment", "demand", "expiry"}


def test_command_center_v2_shape():
    center = ex.executive_command_center_v2()
    assert center.inventory_value >= 0
    assert center.pending_approvals >= 0
    assert center.escalations >= 0
    assert isinstance(center.top_overdue_distributors, list)
    assert isinstance(center.distributor_scores, list)
