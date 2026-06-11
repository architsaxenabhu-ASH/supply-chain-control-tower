"""Phase 3B: commercial readiness, order fulfillment, allocation priority."""

from app.services import allocation_repository as ar
from app.services import fulfillment_intelligence as fu

READINESS_STATUSES = {"Ready", "Waiting Payment", "Waiting Inventory", "Waiting Release", "Waiting Shipment", "Blocked"}


def test_commercial_readiness_status_is_valid():
    for readiness in fu.commercial_readiness():
        assert readiness.status in READINESS_STATUSES


def test_order_fulfillment_readiness_and_stages():
    for order in fu.order_fulfillment():
        assert 0 <= order.fulfillment_readiness_pct <= 100
        assert len(order.stages) == 6
        assert order.expected_next_action


def test_allocation_priority_is_ranked_and_never_allocates():
    before = len(ar.list_allocations())
    priorities = fu.allocation_priority()
    assert [p.rank for p in priorities] == list(range(1, len(priorities) + 1))
    tiers = [p.priority_tier for p in priorities]
    assert tiers == sorted(tiers)  # tier 1 first
    assert len(ar.list_allocations()) == before  # recommendations only
