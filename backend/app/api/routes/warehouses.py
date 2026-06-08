from fastapi import APIRouter, Query

from app.schemas.warehouse import WarehouseLocation
from app.services.warehouse_repository import list_warehouses


router = APIRouter()


@router.get("", response_model=list[WarehouseLocation])
def warehouses(country: str | None = Query(default=None)) -> list[WarehouseLocation]:
    return list_warehouses(country=country)
