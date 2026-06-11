"""Phase 4 P4: returns workflow Returned -> Inspection -> Verification -> Available."""

import pytest

from app.schemas.returns import (
    CreateReturnRequest,
    ReturnInspectionRequest,
    ReturnVerificationRequest,
)
from app.services import returns_repository as rr


def test_full_return_workflow_to_available():
    record = rr.create_return(
        CreateReturnRequest(material="ITEM-R", batch_number="RB-1", return_reason="size mismatch", returned_quantity=10, actor="qa")
    )
    assert record.status == "returned"
    inspected = rr.record_inspection(record.return_id, ReturnInspectionRequest(inspection_result="partial", reusable_quantity=7, rejected_quantity=3, actor="qa"))
    assert inspected.status == "verification"
    verified = rr.record_verification(record.return_id, ReturnVerificationRequest(verification_result="pass", actor="qa"))
    assert verified.status == "available"
    assert verified.reusable_quantity == 7


def test_failed_verification_rejects():
    record = rr.create_return(CreateReturnRequest(material="ITEM-R", batch_number="RB-2", returned_quantity=5, actor="qa"))
    rr.record_inspection(record.return_id, ReturnInspectionRequest(inspection_result="fail", reusable_quantity=0, rejected_quantity=5, actor="qa"))
    verified = rr.record_verification(record.return_id, ReturnVerificationRequest(verification_result="fail", actor="qa"))
    assert verified.status == "rejected"
    assert verified.reusable_quantity == 0


def test_inspection_cannot_exceed_returned_quantity():
    record = rr.create_return(CreateReturnRequest(material="ITEM-R", batch_number="RB-3", returned_quantity=5, actor="qa"))
    with pytest.raises(ValueError):
        rr.record_inspection(record.return_id, ReturnInspectionRequest(inspection_result="pass", reusable_quantity=4, rejected_quantity=4, actor="qa"))


def test_return_dashboard():
    dashboard = rr.return_dashboard()
    assert dashboard.total_returns >= 1
    assert dashboard.available_quantity >= 0
