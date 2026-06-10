from fastapi import APIRouter, HTTPException, Query

from app.schemas.decisions import Decision, DecisionOutcomeRequest, DecisionRequest
from app.services.decision_repository import (
    get_decision,
    list_decisions,
    record_decision,
    update_decision_outcome,
)


router = APIRouter()


@router.get("", response_model=list[Decision])
def decisions(
    decision_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
    related_shipment: str | None = Query(default=None),
) -> list[Decision]:
    return list_decisions(decision_type=decision_type, status=status, related_shipment=related_shipment)


@router.post("", response_model=Decision)
def create(request: DecisionRequest) -> Decision:
    try:
        return record_decision(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/{decision_id}", response_model=Decision)
def detail(decision_id: str) -> Decision:
    decision = get_decision(decision_id)
    if not decision:
        raise HTTPException(status_code=404, detail=f"Decision not found: {decision_id}")
    return decision


@router.patch("/{decision_id}/outcome", response_model=Decision)
def outcome(decision_id: str, request: DecisionOutcomeRequest) -> Decision:
    try:
        return update_decision_outcome(decision_id, request)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
