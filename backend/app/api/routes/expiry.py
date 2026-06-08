from fastapi import APIRouter, Query

from app.schemas.warehouse import InventoryBatch
from app.services.warehouse_repository import list_expiry_alerts, list_inventory_batches


router = APIRouter()


@router.get("/buckets", response_model=list[InventoryBatch])
def expiry_buckets() -> list[InventoryBatch]:
    return list_inventory_batches()


@router.get("/alerts", response_model=list[InventoryBatch])
def expiry_alerts(days: int = Query(default=180, ge=0)) -> list[InventoryBatch]:
    return list_expiry_alerts(days=days)

