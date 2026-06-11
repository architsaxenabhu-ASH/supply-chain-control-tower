from fastapi import APIRouter, HTTPException, Query

from app.schemas.consignment import (
    ConsignmentDashboard,
    ConsignmentInventory,
    ConsignmentReconciliation,
    ConsignmentRisk,
    CreateConsignmentRequest,
    ReportConsignmentRequest,
)
from app.services.consignment_intelligence import (
    consignment_dashboard,
    consignment_reconciliation,
    consignment_risk,
)
from app.services.consignment_repository import (
    create_consignment,
    get_consignment,
    list_consignments,
    report_consignment,
)

inventory_router = APIRouter()
reconciliation_router = APIRouter()
risk_router = APIRouter()
dashboard_router = APIRouter()


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@inventory_router.get("", response_model=list[ConsignmentInventory])
def consignments(
    distributor: str | None = Query(default=None),
    country: str | None = Query(default=None),
) -> list[ConsignmentInventory]:
    return list_consignments(distributor=distributor, country=country)


@inventory_router.post("", response_model=ConsignmentInventory)
def create(request: CreateConsignmentRequest) -> ConsignmentInventory:
    return _guard(lambda: create_consignment(request))


@inventory_router.get("/{consignment_id}", response_model=ConsignmentInventory)
def detail(consignment_id: str) -> ConsignmentInventory:
    record = get_consignment(consignment_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Consignment not found: {consignment_id}")
    return record


@inventory_router.post("/{consignment_id}/report", response_model=ConsignmentInventory)
def report(consignment_id: str, request: ReportConsignmentRequest) -> ConsignmentInventory:
    return _guard(lambda: report_consignment(consignment_id, request))


@reconciliation_router.get("", response_model=list[ConsignmentReconciliation])
def reconciliation() -> list[ConsignmentReconciliation]:
    return consignment_reconciliation()


@risk_router.get("", response_model=list[ConsignmentRisk])
def risk() -> list[ConsignmentRisk]:
    return consignment_risk()


@dashboard_router.get("", response_model=ConsignmentDashboard)
def dashboard() -> ConsignmentDashboard:
    return consignment_dashboard()
