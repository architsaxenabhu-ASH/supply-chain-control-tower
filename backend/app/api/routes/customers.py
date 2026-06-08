from fastapi import APIRouter

from app.schemas.warehouse import Customer
from app.services.warehouse_repository import list_customers


router = APIRouter()


@router.get("", response_model=list[Customer])
def customers() -> list[Customer]:
    return list_customers()

