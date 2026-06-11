from fastapi import APIRouter, HTTPException, Query

from app.schemas.commitments import (
    CommitmentDashboard,
    CommitmentRisk,
    CreateCommitmentRequest,
    CustomerCommitment,
    UpdateCommitmentRequest,
)
from app.services.commitment_intelligence import commitment_dashboard, commitment_risk
from app.services.commitment_repository import (
    create_commitment,
    get_commitment,
    list_commitments,
    update_commitment,
)

commitments_router = APIRouter()
risk_router = APIRouter()
dashboard_router = APIRouter()


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@commitments_router.get("", response_model=list[CustomerCommitment])
def commitments(
    status: str | None = Query(default=None),
    customer: str | None = Query(default=None),
    country: str | None = Query(default=None),
) -> list[CustomerCommitment]:
    return list_commitments(status=status, customer=customer, country=country)


@commitments_router.post("", response_model=CustomerCommitment)
def create(request: CreateCommitmentRequest) -> CustomerCommitment:
    return _guard(lambda: create_commitment(request))


@commitments_router.get("/{commitment_id}", response_model=CustomerCommitment)
def detail(commitment_id: str) -> CustomerCommitment:
    record = get_commitment(commitment_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Commitment not found: {commitment_id}")
    return record


@commitments_router.patch("/{commitment_id}", response_model=CustomerCommitment)
def update(commitment_id: str, request: UpdateCommitmentRequest) -> CustomerCommitment:
    return _guard(lambda: update_commitment(commitment_id, request))


@risk_router.get("", response_model=list[CommitmentRisk])
def risk() -> list[CommitmentRisk]:
    return commitment_risk()


@dashboard_router.get("", response_model=CommitmentDashboard)
def dashboard() -> CommitmentDashboard:
    return commitment_dashboard()
