"""Phase 4 P1: customer commitment lifecycle, risk, dashboard."""

from datetime import date, timedelta

from app.schemas.commitments import CreateCommitmentRequest, UpdateCommitmentRequest
from app.services import commitment_intelligence as ci
from app.services import commitment_repository as cr
from app.services.warehouse_repository import list_inventory_batches


def _item():
    return list_inventory_batches()[0].item_code


def test_new_commitment_is_open_then_fulfilled():
    commitment = cr.create_commitment(
        CreateCommitmentRequest(
            po_number="PO-T1", customer="Apollo", distributor="D", country="Italy", material=_item(),
            ordered_quantity=100, required_delivery_date=(date.today() + timedelta(days=20)).isoformat(), actor="qa",
        )
    )
    assert commitment.status == "open"
    fulfilled = cr.update_commitment(commitment.commitment_id, UpdateCommitmentRequest(delivered_quantity=100, actor="qa"))
    assert fulfilled.status == "fulfilled"
    assert fulfilled.backorder_quantity == 0


def test_partial_progress_is_backordered_when_short():
    commitment = cr.create_commitment(
        CreateCommitmentRequest(
            po_number="PO-T2", customer="Apollo", distributor="D", country="Italy", material=_item(),
            ordered_quantity=100, required_delivery_date=(date.today() + timedelta(days=20)).isoformat(), actor="qa",
        )
    )
    updated = cr.update_commitment(commitment.commitment_id, UpdateCommitmentRequest(delivered_quantity=30, actor="qa"))
    assert updated.status == "backordered"
    assert updated.backorder_quantity == 70


def test_delayed_when_past_required():
    commitment = cr.create_commitment(
        CreateCommitmentRequest(
            po_number="PO-T3", customer="A", distributor="D", country="Italy", material=_item(),
            ordered_quantity=10, required_delivery_date=(date.today() - timedelta(days=5)).isoformat(), actor="qa",
        )
    )
    assert commitment.status == "delayed"


def test_commitment_risk_and_dashboard():
    for risk in ci.commitment_risk():
        assert risk.risk_level in {"Low", "Medium", "High", "Critical"}
        assert 0 <= risk.fill_rate_pct <= 100
    dashboard = ci.commitment_dashboard()
    assert dashboard.total_commitments >= 1
    assert dashboard.otif_pct is not None
