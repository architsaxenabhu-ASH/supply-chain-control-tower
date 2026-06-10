from fastapi import APIRouter, HTTPException, Query

from app.schemas.demand import (
    CountryPerformance,
    CreateDemandRequest,
    CustomerScorecardV2,
    Demand,
    DemandGap,
    DemandIntelligence,
    DemandStatusRequest,
    DistributorHealth,
    DistributorPerformance,
    ExecutiveCommandCenter,
    InventoryEfficiency,
    ProductScorecard,
)
from app.services.commercial_intelligence import (
    country_performance,
    customer_intelligence_v2,
    distributor_health,
    distributor_performance,
    executive_command_center,
    inventory_efficiency,
    product_intelligence,
)
from app.services.demand_intelligence import demand_gap, demand_intelligence
from app.services.demand_repository import create_demand, get_demand, list_demand, update_demand_status

demand_router = APIRouter()
demand_intelligence_router = APIRouter()
demand_gap_router = APIRouter()
customer_v2_router = APIRouter()
distributor_performance_router = APIRouter()
distributor_health_router = APIRouter()
country_performance_router = APIRouter()
product_intelligence_router = APIRouter()
inventory_efficiency_router = APIRouter()
executive_router = APIRouter()


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@demand_router.get("", response_model=list[Demand])
def demand(
    status: str | None = Query(default=None),
    item_code: str | None = Query(default=None),
    country: str | None = Query(default=None),
    distributor: str | None = Query(default=None),
    demand_type: str | None = Query(default=None),
) -> list[Demand]:
    return list_demand(status=status, item_code=item_code, country=country, distributor=distributor, demand_type=demand_type)


@demand_router.post("", response_model=Demand)
def create(request: CreateDemandRequest) -> Demand:
    return _guard(lambda: create_demand(request))


@demand_router.get("/{demand_id}", response_model=Demand)
def detail(demand_id: str) -> Demand:
    record = get_demand(demand_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Demand not found: {demand_id}")
    return record


@demand_router.post("/{demand_id}/status", response_model=Demand)
def set_status(demand_id: str, request: DemandStatusRequest) -> Demand:
    return _guard(lambda: update_demand_status(demand_id, request))


@demand_intelligence_router.get("", response_model=DemandIntelligence)
def intelligence() -> DemandIntelligence:
    return demand_intelligence()


@demand_gap_router.get("", response_model=list[DemandGap])
def gap() -> list[DemandGap]:
    return demand_gap()


@customer_v2_router.get("", response_model=list[CustomerScorecardV2])
def customers_v2() -> list[CustomerScorecardV2]:
    return customer_intelligence_v2()


@distributor_performance_router.get("", response_model=list[DistributorPerformance])
def distributors_performance() -> list[DistributorPerformance]:
    return distributor_performance()


@distributor_health_router.get("", response_model=list[DistributorHealth])
def distributors_health() -> list[DistributorHealth]:
    return distributor_health()


@country_performance_router.get("", response_model=list[CountryPerformance])
def countries_performance() -> list[CountryPerformance]:
    return country_performance()


@product_intelligence_router.get("", response_model=list[ProductScorecard])
def products() -> list[ProductScorecard]:
    return product_intelligence()


@inventory_efficiency_router.get("", response_model=InventoryEfficiency)
def efficiency() -> InventoryEfficiency:
    return inventory_efficiency()


@executive_router.get("", response_model=ExecutiveCommandCenter)
def command_center() -> ExecutiveCommandCenter:
    return executive_command_center()
