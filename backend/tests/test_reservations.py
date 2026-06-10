"""Phase 2C reservation & commitment intelligence: lifecycle, 45-day rule,
consumption, risk, reallocation, scorecards, and the commitment dashboard."""

from datetime import date, timedelta

import pytest

from app.schemas.reservations import (
    ApproveReservationRequest,
    ConsumeReservationRequest,
    CreateReservationRequest,
    ExtendReservationRequest,
    ReallocateRequest,
)
from app.services import reallocation_repository as rar
from app.services import reservation_intelligence as ri
from app.services import reservation_repository as rr


def _create(customer="Apollo", qty=100, res_date=None, expiry=None, item="IT-R", batch="BT-R"):
    return rr.create_reservation(
        CreateReservationRequest(
            customer=customer,
            item_code=item,
            batch_number=batch,
            quantity=qty,
            reservation_date=res_date,
            reservation_expiry_date=expiry,
            actor="qa@example.com",
        )
    )


def test_default_expiry_is_45_days():
    reservation = _create()
    span = (date.fromisoformat(reservation.reservation_expiry_date) - date.fromisoformat(reservation.reservation_date)).days
    assert span == 45


def test_reservation_period_cannot_exceed_45_days():
    with pytest.raises(ValueError):
        _create(expiry=(date.today() + timedelta(days=46)).isoformat())


def test_lifecycle_through_to_consumed():
    reservation = _create(qty=10)
    rr.submit_reservation(reservation.reservation_id, "qa@example.com")
    rr.approve_reservation(reservation.reservation_id, ApproveReservationRequest(approval_user="boss@example.com"))
    reservation = rr.consume_reservation(reservation.reservation_id, ConsumeReservationRequest(quantity=10, actor="qa@example.com"))
    assert reservation.status == "consumed"
    assert reservation.consumed_date is not None


def test_consumption_metrics():
    reservation = _create(qty=100)
    rr.approve_reservation(reservation.reservation_id, ApproveReservationRequest(approval_user="boss@example.com"))
    rr.consume_reservation(reservation.reservation_id, ConsumeReservationRequest(quantity=25, actor="qa@example.com"))
    metric = next(c for c in ri.reservation_consumption() if c.reservation_id == reservation.reservation_id)
    assert metric.consumption_pct == 25.0
    assert metric.remaining_quantity == 75


def test_near_expiry_under_consumed_is_high_risk():
    past = (date.today() - timedelta(days=43)).isoformat()  # default expiry ~2 days out
    reservation = _create(customer="RiskCo", qty=50, res_date=past)
    rr.approve_reservation(reservation.reservation_id, ApproveReservationRequest(approval_user="boss@example.com"))
    risks = {r.reservation_id: r for r in ri.reservation_risk()}
    assert reservation.reservation_id in risks
    assert risks[reservation.reservation_id].risk_level in {"High", "Critical"}
    assert risks[reservation.reservation_id].reservation_expiry_risk is True


def test_reallocate_moves_commitment_to_new_customer():
    reservation = _create(customer="Apollo", qty=80)
    rr.approve_reservation(reservation.reservation_id, ApproveReservationRequest(approval_user="boss@example.com"))
    record = rar.reallocate(
        ReallocateRequest(reservation_id=reservation.reservation_id, new_customer="Fortis", reason="under-consumed", approval_user="boss@example.com")
    )
    assert record.original_customer == "Apollo"
    assert record.new_customer == "Fortis"
    assert rr.get_reservation(reservation.reservation_id).status == "reallocated"
    assert any(r.customer == "Fortis" and r.status == "active" for r in rr.list_reservations())


def test_extend_cannot_exceed_cap():
    reservation = _create(qty=10)
    beyond = (date.fromisoformat(reservation.reservation_date) + timedelta(days=60)).isoformat()
    with pytest.raises(ValueError):
        rar.extend(ExtendReservationRequest(reservation_id=reservation.reservation_id, new_expiry_date=beyond, approval_user="boss@example.com"))


def test_commitment_dashboard_shape():
    dashboard = ri.commitment_dashboard()
    assert dashboard.active_reservations >= 0
    assert dashboard.reservation_value_at_risk >= 0
    assert dashboard.high_risk_reservations >= 0
