"""Validation workflow integrity: goods receipt only after delivery, and a
shipment can only be marked delivered after approval."""

from datetime import date

import pytest

from app.schemas.imports import (
    ImportDeliveryRequest,
    ImportFileCandidate,
    ImportGoodsReceiptPostRequest,
    ImportLineCandidate,
    ImportStatus,
)
from app.schemas.security import SecurityUser
from app.services import import_repository as ir


def _candidate(status: ImportStatus) -> ImportFileCandidate:
    return ImportFileCandidate(
        import_file_number="IMP-TEST-1",
        destination_entity="Meril Italy",
        destination_country="Italy",
        status=status,
        lines=[
            ImportLineCandidate(
                item_code="ITM-1",
                product_description="Device",
                batch_number="B1",
                expiry_date=date(2027, 1, 1),
                quantity=1,
                uom="EA",
                product_profile_status="known",
            )
        ],
    )


def _allow_auth(monkeypatch):
    monkeypatch.setattr(ir, "require_user_permission", lambda _t, _p: SecurityUser(
        email="qa@example.com", full_name="QA", role_name="Admin"
    ))
    monkeypatch.setattr(ir, "ensure_country_scope", lambda *a, **k: None)


def test_goods_receipt_blocked_before_delivery(monkeypatch):
    _allow_auth(monkeypatch)
    request = ImportGoodsReceiptPostRequest(
        candidate=_candidate(ImportStatus.VALIDATED),
        warehouse_name="Milan DC",
        posted_by="qa@example.com",
        auth_token="t",
    )
    with pytest.raises(ValueError):
        ir.post_import_goods_receipt(request)


def test_mark_delivered_requires_approval(monkeypatch):
    _allow_auth(monkeypatch)
    request = ImportDeliveryRequest(
        candidate=_candidate(ImportStatus.VALIDATION_PENDING),
        delivered_by="qa@example.com",
        auth_token="t",
    )
    with pytest.raises(ValueError):
        ir.mark_import_delivered(request)
