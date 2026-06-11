"""Phase 3D payables & partner intelligence: payables, partner financial
scorecards, payables risk, warehouse partner intelligence, and command-center v3."""

from datetime import date, timedelta
from io import BytesIO

import pytest
from openpyxl import Workbook

from app.schemas.payables import CreatePayableRequest
from app.schemas.receivables import RecordPaymentRequest
from app.services import partner_intelligence as pi
from app.services import payables_repository as pr


def _create(partner_type="supplier", name="PayPartner", value=100000, due_offset=30):
    today = date.today()
    return pr.create_payable(
        CreatePayableRequest(
            partner_type=partner_type,
            partner_name=name,
            country="India",
            invoice_number=f"P-{today.toordinal()}-{value}-{due_offset}",
            invoice_date=today.isoformat(),
            due_date=(today + timedelta(days=due_offset)).isoformat(),
            payment_terms="Net 30",
            invoice_value=value,
            actor="qa",
        )
    )


def test_partner_type_validation():
    with pytest.raises(ValueError):
        pr.create_payable(
            CreatePayableRequest(
                partner_type="bogus", partner_name="X", country="Y", invoice_number="Z",
                invoice_date=date.today().isoformat(), due_date=date.today().isoformat(), invoice_value=1, actor="qa",
            )
        )


def test_payment_and_status_transitions():
    record = _create(name="PayCo", value=1000)
    assert record.status == "open"
    partial = pr.record_payment(record.payable_id, RecordPaymentRequest(amount=400, actor="qa"))
    assert partial.status == "partially_paid"
    assert partial.outstanding_value == 600
    paid = pr.record_payment(record.payable_id, RecordPaymentRequest(amount=600, actor="qa"))
    assert paid.status == "paid"


def test_overdue_status():
    assert _create(name="LatePartner", value=5000, due_offset=-10).status == "overdue"


def test_partner_financial_and_payables_risk():
    _create(partner_type="supplier", name="DepCo", value=500000, due_offset=-30)
    card = next(c for c in pi.partner_financial_intelligence() if c.partner_name == "DepCo")
    assert card.past_due_payables > 0
    risk = next(r for r in pi.payables_risk() if r.partner_name == "DepCo")
    assert risk.risk_level in {"High", "Critical"}


def test_excel_upload_creates_payables():
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Partner Type", "Partner Name", "Country", "Invoice Number", "Invoice Date", "Due Date", "Payment Terms", "Invoice Value", "Paid Value"])
    sheet.append(["Freight Forwarder", "DHL", "Germany", "FF-1", "2026-01-01", "2026-02-01", "Net 30", 80000, 0])
    buffer = BytesIO()
    workbook.save(buffer)

    summary = pr.upload_payables(buffer.getvalue(), "qa")
    assert summary.created == 1
    assert any(p.partner_name == "DHL" and p.partner_type == "freight_forwarder" for p in pr.list_payables(partner_name="DHL"))


def test_warehouse_partner_intelligence():
    for warehouse in pi.warehouse_partner_intelligence():
        assert warehouse.inventory_managed >= 0
        if warehouse.inventory_accuracy_pct is not None:
            assert 0 <= warehouse.inventory_accuracy_pct <= 100


def test_command_center_v3_net_exposure():
    v3 = pi.executive_command_center_v3()
    assert round(v3.net_exposure, 2) == round(v3.receivables_outstanding - v3.payables_outstanding, 2)
    assert isinstance(v3.logistics_partner_performance, list)
    assert v3.command_center_v2 is not None
