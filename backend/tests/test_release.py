"""Release Management Engine: the sellable gate is the critical business rule."""

from app.schemas.release import ReleaseAdvanceRequest
from app.services import release_repository as rr


def test_available_for_sale_requires_verification_and_approval():
    # Trying to jump straight to Available For Sale must be refused.
    record = rr.advance_release(
        ReleaseAdvanceRequest(item_code="REL-1", batch_number="B-1", status="Available For Sale", actor="qa@example.com")
    )
    assert record.sellable is False
    assert record.status != "Available For Sale"

    # Verification alone is not enough.
    record = rr.advance_release(
        ReleaseAdvanceRequest(item_code="REL-1", batch_number="B-1", batch_verified=True, actor="qa@example.com")
    )
    assert record.sellable is False

    # Verification + approval => sellable, and auto-advanced to Available For Sale.
    record = rr.advance_release(
        ReleaseAdvanceRequest(item_code="REL-1", batch_number="B-1", approved=True, actor="qa@example.com")
    )
    assert record.sellable is True
    assert record.status == "Available For Sale"


def test_available_not_sellable_explains_each_batch():
    for batch in rr.available_not_sellable():
        assert batch.reason
        assert batch.quantity > 0
