from fastapi import APIRouter, HTTPException, Query

from app.schemas.executive import (
    Approval,
    CreateApprovalRequest,
    DecideApprovalRequest,
    ExecutiveAction,
    ExecutiveCommandCenterV2,
    ExecutiveDecision,
)
from app.services.approval_repository import create_approval, decide_approval, get_approval, list_approvals
from app.services.executive_intelligence import (
    executive_actions,
    executive_command_center_v2,
    executive_decisions,
)

approvals_router = APIRouter()
actions_router = APIRouter()
decisions_router = APIRouter()
command_center_v2_router = APIRouter()


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@approvals_router.get("", response_model=list[Approval])
def approvals(
    approval_type: str | None = Query(default=None),
    outcome: str | None = Query(default=None),
) -> list[Approval]:
    return list_approvals(approval_type=approval_type, outcome=outcome)


@approvals_router.post("", response_model=Approval)
def request_approval(request: CreateApprovalRequest) -> Approval:
    return _guard(lambda: create_approval(request))


@approvals_router.get("/{approval_id}", response_model=Approval)
def approval_detail(approval_id: str) -> Approval:
    approval = get_approval(approval_id)
    if not approval:
        raise HTTPException(status_code=404, detail=f"Approval not found: {approval_id}")
    return approval


@approvals_router.post("/{approval_id}/decide", response_model=Approval)
def decide(approval_id: str, request: DecideApprovalRequest) -> Approval:
    return _guard(lambda: decide_approval(approval_id, request))


@actions_router.get("", response_model=list[ExecutiveAction])
def actions(severity: str | None = Query(default=None)) -> list[ExecutiveAction]:
    return executive_actions(severity=severity)


@decisions_router.get("", response_model=list[ExecutiveDecision])
def decisions() -> list[ExecutiveDecision]:
    return executive_decisions()


@command_center_v2_router.get("", response_model=ExecutiveCommandCenterV2)
def command_center_v2() -> ExecutiveCommandCenterV2:
    return executive_command_center_v2()
