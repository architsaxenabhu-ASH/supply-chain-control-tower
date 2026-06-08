from fastapi import APIRouter

from app.schemas.warehouse import InventoryBatch
from app.services.warehouse_repository import list_fefo_batches, list_inventory_batches


router = APIRouter()


@router.get("/balances")
def list_inventory_balances() -> dict[str, list[InventoryBatch]]:
    return {"items": list_inventory_batches()}


@router.get("/batches", response_model=list[InventoryBatch])
def batches() -> list[InventoryBatch]:
    return list_inventory_batches()


@router.get("/fefo/{item_code}", response_model=list[InventoryBatch])
def fefo_batches(item_code: str) -> list[InventoryBatch]:
    return list_fefo_batches(item_code)


@router.get("/traceability/{batch_number}", response_model=list[InventoryBatch])
def batch_traceability(batch_number: str) -> list[InventoryBatch]:
    return [
        batch
        for batch in list_inventory_batches()
        if batch.batch_number.lower() == batch_number.lower()
    ]
