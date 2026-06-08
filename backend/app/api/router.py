from fastapi import APIRouter

from app.api.routes import (
    assistant,
    customers,
    dashboard,
    dispatches,
    documents,
    expiry,
    goods_receipts,
    inventory,
    inventory_counts,
    imports,
    learning,
    masters,
    products,
    shipments,
    validation,
    warehouses,
)


api_router = APIRouter()
api_router.include_router(masters.router, prefix="/masters", tags=["masters"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(customers.router, prefix="/customers", tags=["customers"])
api_router.include_router(warehouses.router, prefix="/warehouses", tags=["warehouses"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(validation.router, prefix="/validation", tags=["validation"])
api_router.include_router(inventory.router, prefix="/inventory", tags=["inventory"])
api_router.include_router(shipments.router, prefix="/shipments", tags=["shipments"])
api_router.include_router(dispatches.router, prefix="/dispatches", tags=["dispatches"])
api_router.include_router(goods_receipts.router, prefix="/goods-receipts", tags=["goods-receipts"])
api_router.include_router(inventory_counts.router, prefix="/inventory-counts", tags=["inventory-counts"])
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])
api_router.include_router(learning.router, prefix="/learning", tags=["learning"])
api_router.include_router(expiry.router, prefix="/expiry", tags=["expiry"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(assistant.router, prefix="/assistant", tags=["assistant"])
