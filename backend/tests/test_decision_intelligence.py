"""Phase 4 P5 + P7: extended decisions, effectiveness, rule-based similarity,
and learning-insights aggregation."""

from app.schemas.decisions import DecisionOutcomeRequest, DecisionRequest
from app.services import decision_intelligence as di
from app.services import decision_repository as dr
from app.services import learning_aggregation as la


def _seed_effective_decision():
    decision = dr.record_decision(
        DecisionRequest(
            decision_type="Reallocate Stock",
            reason="under-consumed batch near expiry",
            user="qa",
            owner="supply_chain",
            problem_type="expiry_risk",
            context="valve batch near expiry low consumption",
            options_considered=["recall", "reallocate", "discount"],
            related_product="ITEM-D1",
            expected_outcome="avoid write-off",
        )
    )
    dr.update_decision_outcome(
        decision.decision_id,
        DecisionOutcomeRequest(actual_outcome="reallocated and sold", effectiveness="effective", status="closed", actor="qa"),
    )
    return decision


def test_extended_fields_persist():
    decision = _seed_effective_decision()
    stored = dr.get_decision(decision.decision_id)
    assert stored.problem_type == "expiry_risk"
    assert stored.owner == "supply_chain"
    assert stored.effectiveness == "effective"
    assert "reallocate" in stored.options_considered


def test_similarity_matches_problem_type_and_context():
    _seed_effective_decision()
    similar = di.decision_similarity(problem_type="expiry_risk", context="batch expiry consumption low", related_product="ITEM-D1")
    assert similar
    top = similar[0]
    assert "problem_type" in top.matched_on
    assert top.similarity_score >= 40


def test_effectiveness_only_returns_decisions_with_outcome():
    _seed_effective_decision()
    rows = di.decision_effectiveness(problem_type="expiry_risk")
    assert rows
    assert all(r.effectiveness is not None or r.actual_outcome is not None for r in rows)


def test_learning_insights_aggregates_success():
    _seed_effective_decision()
    insights = la.learning_insights()
    assert insights.total_decisions >= 1
    assert insights.decisions_with_outcome >= 1
    assert insights.overall_success_rate_pct is not None
    assert any(p.key == "supply_chain" for p in insights.by_owner)
    assert any(p.key == "expiry_risk" for p in insights.by_problem_type)
