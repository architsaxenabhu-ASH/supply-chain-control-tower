from fastapi import APIRouter

from app.schemas.dashboards import (
    ExecutiveDashboard,
    ExpiryDashboard,
    ImportDashboard,
    InventoryDashboard,
    ShipmentDashboard,
)
from app.schemas.intelligence import SystemHealth
from app.schemas.warehouse import DashboardSummary
from app.services.dashboard_repository import (
    executive_dashboard,
    expiry_dashboard,
    import_dashboard,
    inventory_dashboard,
    shipment_dashboard,
)
from app.services.intelligence_repository import system_health
from app.services.warehouse_repository import dashboard_summary


router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def summary() -> DashboardSummary:
    return dashboard_summary()


@router.get("/executive", response_model=ExecutiveDashboard)
def executive() -> ExecutiveDashboard:
    return executive_dashboard()


@router.get("/inventory", response_model=InventoryDashboard)
def inventory() -> InventoryDashboard:
    return inventory_dashboard()


@router.get("/import", response_model=ImportDashboard)
def imports() -> ImportDashboard:
    return import_dashboard()


@router.get("/expiry", response_model=ExpiryDashboard)
def expiry() -> ExpiryDashboard:
    return expiry_dashboard()


@router.get("/shipment", response_model=ShipmentDashboard)
def shipment() -> ShipmentDashboard:
    return shipment_dashboard()


@router.get("/system-health", response_model=SystemHealth)
def system_health_dashboard() -> SystemHealth:
    return system_health()
