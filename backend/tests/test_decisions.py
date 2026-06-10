"""Decision repository: capture, retrieve, outcome update, and audit integration."""

import pytest

from app.db.local_persistence import list_audit_events
from app.schemas.decisions import DecisionOutcomeRequest, DecisionRequest
from app.services import decision_repository as dr


def test_record_decision_assigns_id_and_audits():
    before = len(dr.list_decisions())
    decision = dr.record_decision(
        DecisionRequest(
            decision_type="Batch Release",
            reason="QC passed for valve lot",
            user="qa@example.com",
            role="Admin",
            related_batch="B-1",
            related_supplier="Test Supplier",
            expected_outcome="Stock available for dispatch",
        )
    )
    assert decision.decision_id.startswith("DEC-")
    assert decision.status == "open"
    assert dr.get_decision(decision.decision_id) is not None
    assert len(dr.list_decisions()) == before + 1
    assert any(
        event["entity_id"] == decision.decision_id and event["module_name"] == "decisions"
        for event in list_audit_events(limit=200)
    )


def test_update_outcome_sets_actual_and_status():
    decision = dr.record_decision(
        DecisionRequest(decision_type="Inventory Disposal", reason="Stock expired", user="qa@example.com")
    )
    updated = dr.update_decision_outcome(
        decision.decision_id,
        DecisionOutcomeRequest(actual_outcome="Scrapped 5 units", status="closed", actor="qa@example.com"),
    )
    assert updated.actual_outcome == "Scrapped 5 units"
    assert updated.status == "closed"


def test_record_decision_requires_type_and_reason():
    with pytest.raises(ValueError):
        dr.record_decision(DecisionRequest(decision_type="", reason="x", user="qa@example.com"))


def test_filter_by_type_and_status():
    dr.record_decision(
        DecisionRequest(decision_type="Shipment Expedite", reason="Urgent order", user="qa@example.com", status="open")
    )
    results = dr.list_decisions(decision_type="Shipment Expedite", status="open")
    assert results
    assert all(item.decision_type == "Shipment Expedite" and item.status == "open" for item in results)
