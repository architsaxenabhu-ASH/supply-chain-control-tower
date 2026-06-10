"""Exception Engine (Phase 2B, P6).

A central place for things that need attention. `scan_exceptions()` derives
exceptions from the other engines - missing documents, shipment delays,
inventory mismatches / batch discrepancies, expiry risk, and missing approvals -
with deterministic ids so re-scanning is idempotent and any manually set owner /
status / root cause / resolution is preserved across scans."""

from __future__ import annotations

from datetime import datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.exceptions import ExceptionUpdateRequest, OperationalException
from app.services.document_readiness import document_readiness
from app.services.release_repository import list_releases
from app.services.shipment_intelligence import shipment_intelligence
from app.services.warehouse_repository import list_inventory_batches, list_inventory_counts

SIX_MONTHS = 182
NEAR_EXPIRY = 90


def _load() -> list[OperationalException]:
    return load_collection("exceptions", lambda payload: OperationalException(**payload))


def _save(exceptions: list[OperationalException]) -> None:
    save_collection("exceptions", exceptions, lambda exception: exception.exception_id)


def list_exceptions(severity: str | None = None, status: str | None = None) -> list[OperationalException]:
    exceptions = _load()
    if severity:
        exceptions = [e for e in exceptions if e.severity.lower() == severity.lower()]
    if status:
        exceptions = [e for e in exceptions if e.status.lower() == status.lower()]
    severity_rank = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    return sorted(exceptions, key=lambda e: (severity_rank.get(e.severity, 9), e.created_at))


def get_exception(exception_id: str) -> OperationalException | None:
    return next((e for e in _load() if e.exception_id == exception_id), None)


def update_exception(exception_id: str, request: ExceptionUpdateRequest) -> OperationalException:
    exceptions = _load()
    exception = next((e for e in exceptions if e.exception_id == exception_id), None)
    if not exception:
        raise ValueError(f"Exception not found: {exception_id}")
    if request.owner is not None:
        exception.owner = request.owner
    if request.status is not None:
        exception.status = request.status
    if request.root_cause is not None:
        exception.root_cause = request.root_cause
    if request.resolution is not None:
        exception.resolution = request.resolution
    exception.updated_at = datetime.now().isoformat()
    _save(exceptions)
    record_audit_event(
        action="exception_update",
        module_name="exceptions",
        entity_name="exception",
        entity_id=exception_id,
        actor=request.actor,
        new_value=exception,
    )
    return exception


def _make(exception_type, severity, title, entity, record, root_cause=None) -> OperationalException:
    safe_record = record.replace("/", "-").replace(" ", "_")
    return OperationalException(
        exception_id=f"{exception_type}:{safe_record}",
        exception_type=exception_type,
        severity=severity,
        title=title,
        related_entity=entity,
        related_record=record,
        status="open",
        root_cause=root_cause,
        created_at=datetime.now().isoformat(),
    )


def _detect() -> list[OperationalException]:
    found: list[OperationalException] = []

    for readiness in document_readiness():
        if readiness.missing_documents:
            core_missing = {"Commercial Invoice", "Packing List"} & set(readiness.missing_documents)
            found.append(
                _make(
                    "missing_documents",
                    "high" if core_missing else "medium",
                    f"{readiness.import_file_number}: missing {', '.join(readiness.missing_documents)}",
                    "import_shipment",
                    readiness.import_file_number,
                )
            )

    for insight in shipment_intelligence():
        if insight.is_delayed:
            found.append(
                _make(
                    "shipment_delay",
                    "high" if insight.delay_days >= 7 else "medium",
                    f"{insight.import_file_number}: delayed {insight.delay_days} day(s) ({insight.delay_category})",
                    "import_shipment",
                    insight.import_file_number,
                    root_cause=insight.root_cause,
                )
            )

    for count in list_inventory_counts():
        for line in count.lines:
            if line.variance_quantity != 0:
                record = f"{line.item_code}/{line.batch_number}"
                found.append(
                    _make(
                        "inventory_mismatch",
                        "high" if abs(line.variance_quantity) >= 10 else "medium",
                        f"{record}: count variance {line.variance_quantity:+g}",
                        "inventory_batch",
                        record,
                    )
                )

    for batch in list_inventory_batches():
        record = f"{batch.item_code}/{batch.batch_number}"
        if batch.days_to_expiry < 0:
            found.append(_make("expiry_risk", "critical", f"{record}: expired", "inventory_batch", record))
        elif batch.days_to_expiry < SIX_MONTHS:
            severity = "high" if batch.days_to_expiry < NEAR_EXPIRY else "medium"
            found.append(
                _make("expiry_risk", severity, f"{record}: expires in {batch.days_to_expiry} day(s)", "inventory_batch", record)
            )

    for release in list_releases():
        if release.batch_verified and not release.approved:
            record = f"{release.item_code}/{release.batch_number}"
            found.append(
                _make("missing_approval", "medium", f"{record}: awaiting release approval", "inventory_batch", record)
            )

    return found


def scan_exceptions() -> list[OperationalException]:
    existing = {e.exception_id: e for e in _load()}
    merged: dict[str, OperationalException] = {}
    for exception in _detect():
        previous = existing.get(exception.exception_id)
        if previous:
            exception.owner = previous.owner
            exception.status = previous.status
            exception.root_cause = exception.root_cause or previous.root_cause
            exception.resolution = previous.resolution
            exception.created_at = previous.created_at
            exception.updated_at = previous.updated_at
        merged[exception.exception_id] = exception
    _save(list(merged.values()))
    return list_exceptions()
