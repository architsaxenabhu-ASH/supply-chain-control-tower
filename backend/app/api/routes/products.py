from fastapi import APIRouter, HTTPException, Query

from app.schemas.warehouse import CreateProductRequest, Product
from app.services.warehouse_repository import create_product, get_product, list_products


router = APIRouter()


@router.get("", response_model=list[Product])
def products(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
) -> list[Product]:
    return list_products(search=search, category=category)


@router.get("/{item_code}", response_model=Product | None)
def product_detail(item_code: str) -> Product | None:
    return get_product(item_code)


@router.post("", response_model=Product)
def add_product(request: CreateProductRequest) -> Product:
    try:
        return create_product(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
