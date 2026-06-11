from fastapi import APIRouter, HTTPException, Query

from app.schemas.commercial import CommercialTarget, PerformanceScorecard, SetTargetRequest
from app.schemas.review import ReviewResponse
from app.services.commercial_performance import performance
from app.services.commercial_targets_repository import list_targets, set_target
from app.services.review_intelligence import (
    country_review,
    distributor_review,
    expiry_review,
    inventory_review,
    open_orders_review,
    receivables_review,
    vertical_review,
)

country_router = APIRouter()
vertical_router = APIRouter()
distributor_router = APIRouter()
customer_router = APIRouter()
targets_router = APIRouter()
review_router = APIRouter()


@country_router.get("", response_model=list[PerformanceScorecard])
def country_performance_v2() -> list[PerformanceScorecard]:
    return performance("country")


@vertical_router.get("", response_model=list[PerformanceScorecard])
def vertical_performance(country: str | None = Query(default=None)) -> list[PerformanceScorecard]:
    return performance("vertical", country=country)


@distributor_router.get("", response_model=list[PerformanceScorecard])
def distributor_performance_v2(
    country: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
) -> list[PerformanceScorecard]:
    return performance("distributor", country=country, vertical=vertical)


@customer_router.get("", response_model=list[PerformanceScorecard])
def customer_performance(
    country: str | None = Query(default=None),
    vertical: str | None = Query(default=None),
    distributor: str | None = Query(default=None),
) -> list[PerformanceScorecard]:
    return performance("customer", country=country, vertical=vertical, distributor=distributor)


@targets_router.get("", response_model=list[CommercialTarget])
def targets(scope: str | None = Query(default=None)) -> list[CommercialTarget]:
    return list_targets(scope=scope)


@targets_router.post("", response_model=CommercialTarget)
def create_target(request: SetTargetRequest) -> CommercialTarget:
    try:
        return set_target(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


# Transaction-driven reviews (P6) - mounted at the API root so paths are
# /inventory-review, /expiry-review, etc.
@review_router.get("/inventory-review", response_model=ReviewResponse)
def review_inventory() -> ReviewResponse:
    return inventory_review()


@review_router.get("/expiry-review", response_model=ReviewResponse)
def review_expiry() -> ReviewResponse:
    return expiry_review()


@review_router.get("/open-orders-review", response_model=ReviewResponse)
def review_open_orders() -> ReviewResponse:
    return open_orders_review()


@review_router.get("/receivables-review", response_model=ReviewResponse)
def review_receivables() -> ReviewResponse:
    return receivables_review()


@review_router.get("/distributor-review", response_model=ReviewResponse)
def review_distributor() -> ReviewResponse:
    return distributor_review()


@review_router.get("/country-review", response_model=ReviewResponse)
def review_country() -> ReviewResponse:
    return country_review()


@review_router.get("/vertical-review", response_model=ReviewResponse)
def review_vertical() -> ReviewResponse:
    return vertical_review()
