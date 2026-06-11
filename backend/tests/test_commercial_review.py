"""Phase 4 P2 + P6: commercial performance (targets vs actual) and the
transaction-driven review endpoints."""

from app.schemas.commercial import SetTargetRequest
from app.services import commercial_performance as cp
from app.services import commercial_targets_repository as ctr
from app.services import review_intelligence as rv


def test_target_only_scope_shows_zero_achievement():
    ctr.set_target(SetTargetRequest(scope="country", scope_value="Narnia", target_value=1000000, target_quantity=500, actor="boss"))
    row = next(r for r in cp.performance("country") if r.name == "Narnia")
    assert row.target_value == 1000000
    assert row.actual_value == 0
    assert row.value_achievement_pct == 0.0
    assert row.diagnostics["sales_performance"] == "below_target"


def test_target_scope_validation():
    import pytest

    with pytest.raises(ValueError):
        ctr.set_target(SetTargetRequest(scope="bogus", scope_value="X", actor="boss"))


def test_reviews_are_transaction_driven():
    for builder in (rv.inventory_review, rv.expiry_review, rv.open_orders_review, rv.receivables_review, rv.distributor_review, rv.country_review, rv.vertical_review):
        review = builder()
        assert review.review_type
        assert isinstance(review.summary, dict)
        for item in review.items:
            assert item.reference
            assert item.source


def test_inventory_review_items_have_drilldown_detail():
    review = rv.inventory_review()
    assert review.summary["batch_count"] == len(review.items)
    for item in review.items:
        assert "inventory_value" in item.detail
        assert "days_to_expiry" in item.detail
