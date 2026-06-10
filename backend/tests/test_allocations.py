"""Phase 2D allocation & distribution intelligence: allocations, the single
source of truth, distributor/country scorecards, recommendations, dashboard."""

import pytest

from app.schemas.allocations import (
    ApproveAllocationRequest,
    ConsumeAllocationRequest,
    CreateAllocationRequest,
)
from app.services import allocation_repository as ar
from app.services import commitment_integration as ci
from app.services import distribution_intelligence as di
from app.services.warehouse_repository import get_product, list_inventory_batches


def _largest_open_batch():
    candidates = [b for b in list_inventory_batches() if b.days_to_expiry >= 0]
    return max(candidates, key=lambda b: b.quantity_available)


def test_allocation_requires_country_and_distributor():
    with pytest.raises(ValueError):
        ar.create_allocation(CreateAllocationRequest(item_code="X", country="", distributor="D", batch_number="B", quantity=1, actor="qa"))
    with pytest.raises(ValueError):
        ar.create_allocation(CreateAllocationRequest(item_code="X", country="Italy", distributor="", batch_number="B", quantity=1, actor="qa"))


def test_allocation_derives_vertical_from_product_master():
    batch = _largest_open_batch()
    allocation = ar.create_allocation(
        CreateAllocationRequest(item_code=batch.item_code, country="Italy", distributor="DistA", batch_number=batch.batch_number, quantity=1, actor="qa")
    )
    product = get_product(batch.item_code)
    assert allocation.vertical == (product.product_category if product else None)


def test_commitment_reconciles_and_commitments_reduce_available():
    batch = _largest_open_batch()
    before = ci.inventory_commitment()
    allocation = ar.create_allocation(
        CreateAllocationRequest(item_code=batch.item_code, country="Italy", distributor="DistB", batch_number=batch.batch_number, quantity=3, actor="qa")
    )
    ar.approve_allocation(allocation.allocation_id, ApproveAllocationRequest(approval_user="boss"))
    after = ci.inventory_commitment()

    # The defining invariant of the single source of truth.
    reconciled = (
        after.physical_inventory
        - after.reserved_inventory
        - after.allocated_inventory
        - after.blocked_inventory
        - after.quarantine_inventory
        - after.expired_inventory
    )
    assert round(reconciled, 2) == round(after.available_inventory, 2)
    # An active allocation moves 3 units from Available to Allocated.
    assert round(after.allocated_inventory - before.allocated_inventory, 2) == 3
    assert round(before.available_inventory - after.available_inventory, 2) == 3


def test_distributor_utilization_is_computed():
    batch = _largest_open_batch()
    allocation = ar.create_allocation(
        CreateAllocationRequest(item_code=batch.item_code, country="Italy", distributor="UtilCo", batch_number=batch.batch_number, quantity=10, actor="qa")
    )
    ar.approve_allocation(allocation.allocation_id, ApproveAllocationRequest(approval_user="boss"))
    ar.consume_allocation(allocation.allocation_id, ConsumeAllocationRequest(quantity=4, actor="qa"))
    card = next(c for c in di.distributor_intelligence() if c.distributor == "UtilCo")
    assert card.allocation_utilization_pct == 40.0
    assert card.inventory_allocated == 10


def test_recommendations_sorted_and_never_auto_allocate():
    before = len(ar.list_allocations())
    recommendations = di.allocation_recommendations()
    scores = [r.recommendation_score for r in recommendations]
    assert scores == sorted(scores, reverse=True)
    # Recommendations must not create allocations.
    assert len(ar.list_allocations()) == before


def test_allocation_dashboard_shape():
    dashboard = di.allocation_dashboard()
    assert dashboard.active_allocations >= 0
    assert dashboard.allocation_value >= 0
    assert dashboard.inventory_locked_in_allocations >= 0
