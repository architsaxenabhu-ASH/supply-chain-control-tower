from fastapi import APIRouter, HTTPException, Query

from app.schemas.decisions import (
    Decision,
    DecisionEffectiveness,
    DecisionLearningInsights,
    DecisionOutcomeRequest,
    DecisionRequest,
    SimilarDecision,
)
from app.services.decision_intelligence import decision_effectiveness, decision_history, decision_similarity
from app.services.decision_repository import (
    get_decision,
    list_decisions,
    record_decision,
    update_decision_outcome,
)
from app.services.learning_aggregation import learning_insights


router = APIRouter()
effectiveness_router = APIRouter()
history_router = APIRouter()
similarity_router = APIRouter()
learning_router = APIRouter()


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


@effectiveness_router.get("", response_model=list[DecisionEffectiveness])
def effectiveness(
    owner: str | None = Query(default=None),
    problem_type: str | None = Query(default=None),
) -> list[DecisionEffectiveness]:
    return decision_effectiveness(owner=owner, problem_type=problem_type)


@history_router.get("", response_model=list[Decision])
def history(
    owner: str | None = Query(default=None),
    problem_type: str | None = Query(default=None),
    related: str | None = Query(default=None),
) -> list[Decision]:
    return decision_history(owner=owner, problem_type=problem_type, related=related)


@similarity_router.get("", response_model=list[SimilarDecision])
def similarity(
    problem_type: str | None = Query(default=None),
    decision_type: str | None = Query(default=None),
    context: str | None = Query(default=None),
    related_product: str | None = Query(default=None),
    related_customer: str | None = Query(default=None),
    related_supplier: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
) -> list[SimilarDecision]:
    return decision_similarity(
        problem_type=problem_type,
        decision_type=decision_type,
        context=context,
        related_product=related_product,
        related_customer=related_customer,
        related_supplier=related_supplier,
        limit=limit,
    )


@learning_router.get("", response_model=DecisionLearningInsights)
def insights() -> DecisionLearningInsights:
    return learning_insights()
