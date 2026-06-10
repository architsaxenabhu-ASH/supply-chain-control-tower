"""Phase 2E + 2F: demand engine, demand intelligence/gap, and the commercial
intelligence composition (customer/distributor/country/product/efficiency/exec)."""

import pytest

from app.db.local_persistence import list_audit_events
from app.schemas.demand import CreateDemandRequest, DemandStatusRequest
from app.services import commercial_intelligence as ci
from app.services import demand_intelligence as di
from app.services import demand_repository as dr
from app.services.commitment_integration import inventory_commitment
from app.services.warehouse_repository import list_inventory_batches

CATEGORIES = {"High Performer", "Stable Performer", "Underperformer", "High Expiry Risk", "High Growth Opportunity"}


def _item():
    return list_inventory_batches()[0].item_code


def test_demand_type_validation_and_audit():
    with pytest.raises(ValueError):
        dr.create_demand(CreateDemandRequest(item_code="X", country="Italy", distributor="D", demand_type="bogus", quantity=1, actor="qa"))
    demand = dr.create_demand(
        CreateDemandRequest(item_code=_item(), country="Italy", distributor="D", demand_type="confirmed", quantity=50, actor="qa")
    )
    assert demand.status == "open"
    assert any(e["entity_id"] == demand.demand_id and e["module_name"] == "demand" for e in list_audit_events(limit=200))


def test_demand_status_update_validated():
    demand = dr.create_demand(
        CreateDemandRequest(item_code=_item(), country="Italy", distributor="D", demand_type="forecast", quantity=10, actor="qa")
    )
    assert dr.update_demand_status(demand.demand_id, DemandStatusRequest(status="closed", actor="qa")).status == "closed"
    with pytest.raises(ValueError):
        dr.update_demand_status(demand.demand_id, DemandStatusRequest(status="bogus", actor="qa"))


def test_demand_intelligence_types_sum_to_total():
    for product in di.demand_intelligence().by_product:
        parts = product.confirmed_demand + product.forecast_demand + product.tender_demand + product.opportunity_demand
        assert round(parts, 2) == round(product.total_demand, 2)


def test_demand_gap_surplus_shortage_consistent():
    for gap in di.demand_gap():
        assert gap.surplus >= 0 and gap.shortage >= 0
        assert not (gap.surplus > 0 and gap.shortage > 0)


def test_demand_gap_shortage_when_demand_exceeds_available():
    item = _item()
    dr.create_demand(CreateDemandRequest(item_code=item, country="Italy", distributor="D", demand_type="confirmed", quantity=1_000_000, actor="qa"))
    gap = next(g for g in di.demand_gap() if g.item_code == item)
    assert gap.shortage > 0
    assert gap.coverage_pct is not None and gap.coverage_pct < 100


def test_distributor_health_score_and_category():
    for health in ci.distributor_health():
        assert 0 <= health.health_score <= 100
        assert health.category in CATEGORIES


def test_inventory_efficiency_matches_commitment():
    efficiency = ci.inventory_efficiency()
    commitment = inventory_commitment()
    assert efficiency.physical_inventory == commitment.physical_inventory
    assert efficiency.available_inventory == commitment.available_inventory
    assert 0 <= efficiency.inventory_efficiency_score <= 100


def test_country_performance_includes_demand_only_countries():
    dr.create_demand(CreateDemandRequest(item_code=_item(), country="Testland", distributor="D", demand_type="tender", quantity=5, actor="qa"))
    cards = {c.country: c for c in ci.country_performance()}
    assert "Testland" in cards
    assert cards["Testland"].demand >= 5


def test_product_intelligence_shape():
    for product in ci.product_intelligence():
        assert product.item_code
        assert product.inventory >= 0 and product.demand >= 0


def test_executive_command_center_shape():
    center = ci.executive_command_center()
    assert center.total_inventory_value >= 0
    assert center.confirmed_demand >= 0
    assert isinstance(center.top_distributors, list)
    assert isinstance(center.highest_demand_products, list)
