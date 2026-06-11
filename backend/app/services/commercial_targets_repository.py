"""Commercial targets store (Phase 4, P2). Targets per scope (country / vertical
/ distributor / customer). Genuinely new data (targets are not modelled
elsewhere); kept minimal. Audited."""

from __future__ import annotations

from datetime import datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.commercial import TARGET_SCOPES, CommercialTarget, SetTargetRequest


def _load() -> list[CommercialTarget]:
    return load_collection("commercial_targets", lambda payload: CommercialTarget(**payload))


def _key(target: CommercialTarget) -> str:
    return f"{target.scope.lower()}|{target.scope_value.lower()}|{(target.period or '').lower()}"


def _save(records: list[CommercialTarget]) -> None:
    save_collection("commercial_targets", records, _key)


def set_target(request: SetTargetRequest) -> CommercialTarget:
    scope = request.scope.strip().lower()
    if scope not in TARGET_SCOPES:
        raise ValueError(f"Scope must be one of {TARGET_SCOPES}.")
    target = CommercialTarget(
        scope=scope,
        scope_value=request.scope_value.strip(),
        target_value=request.target_value,
        target_quantity=request.target_quantity,
        period=request.period,
        updated_by=request.actor,
        updated_at=datetime.now().isoformat(),
    )
    records = [t for t in _load() if _key(t) != _key(target)]
    _save([target, *records])
    record_audit_event(
        action="target_set",
        module_name="commercial",
        entity_name="commercial_target",
        entity_id=f"{target.scope}:{target.scope_value}",
        actor=request.actor,
        new_value=target,
    )
    return target


def list_targets(scope: str | None = None) -> list[CommercialTarget]:
    records = _load()
    if scope:
        records = [t for t in records if t.scope.lower() == scope.lower()]
    return records


def targets_by_value(scope: str) -> dict[str, CommercialTarget]:
    return {t.scope_value.lower(): t for t in list_targets(scope)}
