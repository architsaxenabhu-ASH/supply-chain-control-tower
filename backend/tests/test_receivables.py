"""Phase 3A financial intelligence: receivables, payments, Excel upload,
financial scorecards, payment risk, and credit control with override."""

from datetime import date, timedelta
from io import BytesIO

from openpyxl import Workbook

from app.schemas.receivables import (
    CreateReceivableRequest,
    RecordPaymentRequest,
    SetCreditLimitRequest,
)
from app.services import financial_intelligence as fi
from app.services import receivables_repository as rr


def _create(distributor="FinCo", value=100000, due_offset=30, invoice_offset=0, paid=0):
    today = date.today()
    return rr.create_receivable(
        CreateReceivableRequest(
            distributor=distributor,
            country="Italy",
            invoice_number=f"INV-{int(today.toordinal())}-{value}-{due_offset}",
            invoice_date=(today - timedelta(days=invoice_offset)).isoformat(),
            due_date=(today + timedelta(days=due_offset)).isoformat(),
            payment_terms="Net 30",
            invoice_value=value,
            paid_value=paid,
            actor="qa",
        )
    )


def test_payment_updates_outstanding_and_status():
    record = _create(distributor="PayCo", value=1000)
    assert record.status == "open"
    updated = rr.record_payment(record.receivable_id, RecordPaymentRequest(amount=400, actor="qa"))
    assert updated.status == "partially_paid"
    assert updated.outstanding_value == 600
    final = rr.record_payment(record.receivable_id, RecordPaymentRequest(amount=600, actor="qa"))
    assert final.status == "paid"
    assert final.outstanding_value == 0


def test_overdue_status_when_past_due():
    record = _create(distributor="LateCo", value=5000, due_offset=-10)
    assert record.status == "overdue"


def test_financial_scorecard_and_payment_risk():
    _create(distributor="RiskCo", value=100000, due_offset=-95)  # very overdue
    card = next(c for c in fi.distributor_financial_intelligence() if c.distributor == "RiskCo")
    assert card.past_due_amount > 0
    assert card.past_due_days >= 90
    risk = next(r for r in fi.payment_risk() if r.distributor == "RiskCo")
    assert risk.risk_level == "Critical"


def test_credit_control_blocks_when_exposure_exceeds_limit_and_override_clears():
    _create(distributor="CreditCo", value=130000, due_offset=20)
    rr.set_credit_limit(SetCreditLimitRequest(distributor="CreditCo", credit_limit=100000, actor="boss"))
    control = next(c for c in fi.credit_control() if c.distributor == "CreditCo")
    assert control.status == "blocked"
    assert control.available_credit < 0
    rr.set_credit_override("CreditCo", True, "Management approved", "boss")
    overridden = next(c for c in fi.credit_control() if c.distributor == "CreditCo")
    assert overridden.status == "healthy"
    assert overridden.override is True


def test_excel_upload_creates_receivables():
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(["Distributor", "Country", "Invoice Number", "Invoice Date", "Due Date", "Payment Terms", "Invoice Value", "Paid Value"])
    sheet.append(["ExcelCo", "India", "XL-1", "2026-01-01", "2026-02-01", "Net 30", 75000, 0])
    buffer = BytesIO()
    workbook.save(buffer)

    summary = rr.upload_receivables(buffer.getvalue(), "qa")
    assert summary.created == 1
    assert any(r.invoice_number == "XL-1" for r in rr.list_receivables(distributor="ExcelCo"))
