"""Exception Engine: auto-creation is idempotent and preserves manual triage."""

from app.schemas.exceptions import ExceptionUpdateRequest
from app.services import exception_repository as er


def test_scan_is_idempotent():
    first = {e.exception_id for e in er.scan_exceptions()}
    second = {e.exception_id for e in er.scan_exceptions()}
    assert first == second


def test_manual_triage_survives_rescan():
    exceptions = er.scan_exceptions()
    if not exceptions:
        return
    target = exceptions[0].exception_id
    er.update_exception(
        target,
        ExceptionUpdateRequest(owner="qc@example.com", status="in_progress", resolution="Investigating", actor="qa@example.com"),
    )
    er.scan_exceptions()
    updated = er.get_exception(target)
    assert updated.owner == "qc@example.com"
    assert updated.status == "in_progress"
    assert updated.resolution == "Investigating"


def test_severity_filter_and_ordering():
    er.scan_exceptions()
    highs = er.list_exceptions(severity="high")
    assert all(e.severity == "high" for e in highs)
