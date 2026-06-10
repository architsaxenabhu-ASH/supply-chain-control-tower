from fastapi import APIRouter, HTTPException, Query

from app.schemas.allocations import (
    Allocation,
    AllocationActionRequest,
    AllocationDashboard,
    AllocationRecommendation,
    ApproveAllocationRequest,
    ConsumeAllocationRequest,
    CountryScorecard,
    CreateAllocationRequest,
    DistributorScorecard,
    InventoryCommitment,
)
from app.services.allocation_repository import (
    approve_allocation,
    consume_allocation,
    create_allocation,
    get_allocation,
    list_allocations,
    release_allocation,
)
from app.services.commitment_integration import inventory_commitment
from app.services.distribution_intelligence import (
    allocation_dashboard,
    allocation_recommendations,
    country_intelligence,
    distributor_intelligence,
)

allocations_router = APIRouter()
commitment_router = APIRouter()
distributor_router = APIRouter()
country_router = APIRouter()
recommendations_router = APIRouter()
allocation_dashboard_router = APIRouter()


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@allocations_router.get("", response_model=list[Allocation])
def allocations(
    status: str | None = Query(default=None),
    country: str | None = Query(default=None),
    distributor: str | None = Query(default=None),
) -> list[Allocation]:
    return list_allocations(status=status, country=country, distributor=distributor)


@allocations_router.post("", response_model=Allocation)
def create(request: CreateAllocationRequest) -> Allocation:
    return _guard(lambda: create_allocation(request))


@allocations_router.get("/{allocation_id}", response_model=Allocation)
def detail(allocation_id: str) -> Allocation:
    allocation = get_allocation(allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail=f"Allocation not found: {allocation_id}")
    return allocation


@allocations_router.post("/{allocation_id}/approve", response_model=Allocation)
def approve(allocation_id: str, request: ApproveAllocationRequest) -> Allocation:
    return _guard(lambda: approve_allocation(allocation_id, request))


@allocations_router.post("/{allocation_id}/consume", response_model=Allocation)
def consume(allocation_id: str, request: ConsumeAllocationRequest) -> Allocation:
    return _guard(lambda: consume_allocation(allocation_id, request))


@allocations_router.post("/{allocation_id}/release", response_model=Allocation)
def release(allocation_id: str, request: AllocationActionRequest) -> Allocation:
    return _guard(lambda: release_allocation(allocation_id, request.actor))


@commitment_router.get("", response_model=InventoryCommitment)
def commitment() -> InventoryCommitment:
    return inventory_commitment()


@distributor_router.get("", response_model=list[DistributorScorecard])
def distributors() -> list[DistributorScorecard]:
    return distributor_intelligence()


@country_router.get("", response_model=list[CountryScorecard])
def countries() -> list[CountryScorecard]:
    return country_intelligence()


@recommendations_router.get("", response_model=list[AllocationRecommendation])
def recommendations(item_code: str | None = Query(default=None)) -> list[AllocationRecommendation]:
    return allocation_recommendations(item_code=item_code)


@allocation_dashboard_router.get("", response_model=AllocationDashboard)
def dashboard() -> AllocationDashboard:
    return allocation_dashboard()
