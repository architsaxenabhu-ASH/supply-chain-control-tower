from fastapi import APIRouter

from app.schemas.warehouse import DashboardSummary
from app.services.warehouse_repository import dashboard_summary


router = APIRouter()


@router.get("/summary", response_model=DashboardSummary)
def summary() -> DashboardSummary:
    return dashboard_summary()

