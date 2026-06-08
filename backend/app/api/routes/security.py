from fastapi import APIRouter, HTTPException

from app.schemas.security import (
    ApprovalResolution,
    ApprovalResolutionRequest,
    ApprovalRule,
    SaveApprovalRuleRequest,
    SaveSecurityUserRequest,
    SecurityOverview,
    SecurityUser,
)
from app.services.security_repository import (
    get_security_overview,
    resolve_approver,
    save_approval_rule,
    save_security_user,
)


router = APIRouter()


@router.get("", response_model=SecurityOverview)
def security_overview() -> SecurityOverview:
    return get_security_overview()


@router.post("/users", response_model=SecurityUser)
def upsert_user(request: SaveSecurityUserRequest) -> SecurityUser:
    try:
        return save_security_user(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/approval-rules", response_model=ApprovalRule)
def upsert_approval_rule(request: SaveApprovalRuleRequest) -> ApprovalRule:
    try:
        return save_approval_rule(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/resolve-approver", response_model=ApprovalResolution)
def get_approver(request: ApprovalResolutionRequest) -> ApprovalResolution:
    return resolve_approver(request)
