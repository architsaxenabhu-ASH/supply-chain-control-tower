"""Phase 4 P3: consignment store, reconciliation, risk, recommendations."""

from datetime import date, timedelta

from app.schemas.consignment import CreateConsignmentRequest, ReportConsignmentRequest
from app.services import consignment_intelligence as csi
from app.services import consignment_repository as csr


def _create(distributor="DistA", sent=100, days_ago=10, batch="CNS-B1"):
    return csr.create_consignment(
        CreateConsignmentRequest(
            distributor=distributor, country="Italy", material="ITEM-CNS", batch_number=batch,
            quantity_sent=sent, sent_date=(date.today() - timedelta(days=days_ago)).isoformat(), actor="qa",
        )
    )


def test_report_updates_remaining_and_reconciliation():
    record = _create(sent=100, batch="CNS-REC")
    csr.report_consignment(record.consignment_id, ReportConsignmentRequest(quantity_reported=60, quantity_consumed=40, actor="qa"))
    reconciliation = next(r for r in csi.consignment_reconciliation() if r.consignment_id == record.consignment_id)
    assert reconciliation.expected_remaining == 60
    assert reconciliation.reported_remaining == 60
    assert reconciliation.reconciled is True


def test_aged_unreported_consignment_is_high_risk():
    record = _create(sent=100, days_ago=150, batch="CNS-OLD")  # aged, never reported
    risk = next(r for r in csi.consignment_risk() if r.consignment_id == record.consignment_id)
    assert risk.no_report is True
    assert risk.aging is True
    assert risk.risk_level in {"High", "Critical"}
    assert risk.recommended_action == "Verify Inventory Position"


def test_consignment_dashboard():
    dashboard = csi.consignment_dashboard()
    assert dashboard.total_consignments >= 1
    assert dashboard.no_report_count >= 0
