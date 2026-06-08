from fastapi import APIRouter, Query

from app.db.local_persistence import list_audit_events
from app.schemas.audit import AuditEvent


router = APIRouter()


@router.get("", response_model=list[AuditEvent])
def audit_events(limit: int = Query(default=100, ge=1, le=500)) -> list[AuditEvent]:
    return [AuditEvent(**event) for event in list_audit_events(limit=limit)]
