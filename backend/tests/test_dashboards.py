"""Dashboard data layer: every dashboard endpoint returns consistent metrics."""

from app.schemas.dashboards import (
    ExecutiveDashboard,
    ExpiryDashboard,
    ImportDashboard,
    InventoryDashboard,
    ShipmentDashboard,
)
from app.services import dashboard_repository as dr


def test_all_dashboards_return_their_models():
    assert isinstance(dr.executive_dashboard(), ExecutiveDashboard)
    assert isinstance(dr.inventory_dashboard(), InventoryDashboard)
    assert isinstance(dr.import_dashboard(), ImportDashboard)
    assert isinstance(dr.expiry_dashboard(), ExpiryDashboard)
    assert isinstance(dr.shipment_dashboard(), ShipmentDashboard)


def test_expiry_buckets_are_monotonic():
    ex = dr.expiry_dashboard()
    assert ex.expiring_30 <= ex.expiring_60 <= ex.expiring_90 <= ex.expiring_180


def test_import_status_counts_sum_to_total():
    imp = dr.import_dashboard()
    assert sum(imp.by_status.values()) == imp.total


def test_shipment_status_counts_sum_to_total():
    sh = dr.shipment_dashboard()
    assert sum(sh.by_status.values()) == sh.total


def test_inventory_value_is_non_negative():
    inv = dr.inventory_dashboard()
    assert inv.total_value >= 0
    assert inv.batch_count >= 0
