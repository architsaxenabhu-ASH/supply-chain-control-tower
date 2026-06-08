from fastapi import APIRouter, HTTPException

from app.schemas.warehouse import CreateInventoryCountRequest, PhysicalInventoryCount
from app.services.warehouse_repository import create_inventory_count, list_inventory_counts


router = APIRouter()


@router.get("", response_model=list[PhysicalInventoryCount])
def inventory_counts() -> list[PhysicalInventoryCount]:
    return list_inventory_counts()


@router.post("", response_model=PhysicalInventoryCount)
def create_count(request: CreateInventoryCountRequest) -> PhysicalInventoryCount:
    try:
        return create_inventory_count(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.get("/variance-summary")
def variance_summary() -> dict[str, float]:
    summary = {"excess": 0.0, "deficit": 0.0}
    for inventory_count in list_inventory_counts():
        for line in inventory_count.lines:
            if line.variance_quantity > 0:
                summary["excess"] += line.variance_quantity
            if line.variance_quantity < 0:
                summary["deficit"] += abs(line.variance_quantity)
    return summary
