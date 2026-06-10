"""Shipment Delay Intelligence (Phase 2B, P3).

Compares planned vs actual milestones per import shipment to surface the delay
and its days, alongside carrier / route / country. Delay category, reason, and
root cause are captured by users into a small store (free-form categories, no
hardcoded country logic); when none is recorded the category is auto-derived."""

from __future__ import annotations

from datetime import date, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.operational_intelligence import DelayReasonRequest, ShipmentDelayInsight
from app.services.import_repository import get_shipment_timeline, list_import_candidates


def _load_delay_reasons() -> list[dict]:
    return load_collection("shipment_delay_reasons", lambda payload: payload)


def record_delay_reason(request: DelayReasonRequest) -> dict:
    entries = [e for e in _load_delay_reasons() if e["import_file_number"] != request.import_file_number]
    entry = {
        "import_file_number": request.import_file_number,
        "delay_category": request.delay_category,
        "delay_reason": request.delay_reason,
        "root_cause": request.root_cause,
        "actor": request.actor,
        "updated_at": datetime.now().isoformat(),
    }
    save_collection("shipment_delay_reasons", [entry, *entries], lambda e: e["import_file_number"])
    record_audit_event(
        action="delay_reason",
        module_name="shipment_intelligence",
        entity_name="shipment_delay",
        entity_id=request.import_file_number,
        actor=request.actor,
        new_value=entry,
    )
    return entry


def _delay_reason_map() -> dict[str, dict]:
    return {entry["import_file_number"]: entry for entry in _load_delay_reasons()}


def _auto_category(candidate) -> str:
    if not candidate.commercial_invoice_document_ids or not candidate.packing_list_document_ids:
        return "Missing Documents"
    if candidate.status.value in {"customs_in_progress", "country_documents_pending"}:
        return "Customs"
    if candidate.status.value in {"validation_pending", "extracted", "uploaded"}:
        return "Approval"
    return "Other"


def shipment_intelligence() -> list[ShipmentDelayInsight]:
    reasons = _delay_reason_map()
    insights: list[ShipmentDelayInsight] = []
    for candidate in list_import_candidates():
        timeline = get_shipment_timeline(candidate.import_file_number)
        planned = actual = None
        delay_days = 0
        for milestone in timeline.milestones:
            if milestone.status == "late" and milestone.planned_date and milestone.actual_date:
                days = (date.fromisoformat(milestone.actual_date) - date.fromisoformat(milestone.planned_date)).days
                if days > delay_days:
                    delay_days = days
                    planned = milestone.planned_date
                    actual = milestone.actual_date
        is_delayed = delay_days > 0
        reason = reasons.get(candidate.import_file_number)
        category = reason["delay_category"] if reason else (_auto_category(candidate) if is_delayed else None)

        insights.append(
            ShipmentDelayInsight(
                import_file_number=candidate.import_file_number,
                shipment_name=candidate.shipment_name,
                carrier=candidate.carrier_name,
                route=f"{candidate.origin_country or 'Unknown'} -> {candidate.destination_country}",
                country=candidate.destination_country,
                planned_date=planned,
                actual_date=actual,
                delay_days=delay_days,
                delay_category=category,
                delay_reason=reason["delay_reason"] if reason else None,
                root_cause=reason["root_cause"] if reason else None,
                is_delayed=is_delayed,
            )
        )
    return insights
