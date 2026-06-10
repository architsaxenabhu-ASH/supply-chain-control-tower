"""Tamper-evident, immutable audit trail (hash chain)."""

from sqlalchemy import update

from app.db import local_persistence as lp


def test_recorded_events_are_hashed_and_chain_verifies():
    lp.record_audit_event(action="alpha", module_name="test", entity_name="e", entity_id="1", actor="qa")
    lp.record_audit_event(action="beta", module_name="test", entity_name="e", entity_id="2", actor="qa")

    events = lp.list_audit_events(limit=5)
    assert events[0]["event_hash"]
    assert events[1]["event_hash"]

    result = lp.verify_audit_chain()
    assert result["valid"] is True
    assert result["verified_count"] >= 2


def test_tampering_with_an_event_breaks_the_chain():
    lp.record_audit_event(action="gamma", module_name="test", entity_name="e", entity_id="3", actor="qa")

    with lp.get_engine().begin() as connection:
        row = (
            connection.execute(
                lp.select(lp.audit_events)
                .where(lp.audit_events.c.event_hash.is_not(None))
                .order_by(lp.audit_events.c.id)
            )
            .mappings()
            .first()
        )
        connection.execute(
            update(lp.audit_events).where(lp.audit_events.c.id == row["id"]).values(actor="HACKER")
        )

    result = lp.verify_audit_chain()
    assert result["valid"] is False
    assert result["broken_at_id"] is not None
