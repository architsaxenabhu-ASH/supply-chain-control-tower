from fastapi import APIRouter, HTTPException, Query

from app.schemas.audit import AuditEvent
from app.schemas.master_data import (
    DuplicateCheckResponse,
    MasterRecord,
    SetMasterStatusRequest,
    UpsertMasterRecordRequest,
)
from app.services.master_data_repository import (
    check_duplicate,
    list_master_records,
    master_record_history,
    set_master_status,
    upsert_master_record,
)


router = APIRouter()


@router.get("", response_model=list[MasterRecord])
def master_records(
    entity_type: str | None = Query(default=None),
    active_only: bool = Query(default=False),
) -> list[MasterRecord]:
    return list_master_records(entity_type=entity_type, active_only=active_only)


@router.post("", response_model=MasterRecord)
def upsert(request: UpsertMasterRecordRequest) -> MasterRecord:
    try:
        return upsert_master_record(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/status", response_model=MasterRecord)
def set_status(request: SetMasterStatusRequest) -> MasterRecord:
    try:
        return set_master_status(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/duplicate-check", response_model=DuplicateCheckResponse)
def duplicate_check(entity_type: str, code: str) -> DuplicateCheckResponse:
    return check_duplicate(entity_type=entity_type, code=code)


@router.get("/history", response_model=list[AuditEvent])
def history(entity_type: str, code: str) -> list[AuditEvent]:
    return [AuditEvent(**event) for event in master_record_history(entity_type, code)]
