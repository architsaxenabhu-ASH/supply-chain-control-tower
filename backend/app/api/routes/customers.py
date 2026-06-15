from fastapi import APIRouter, HTTPException

from app.schemas.warehouse import CreateCustomerRequest, Customer
from app.services.warehouse_repository import create_customer, list_customers


router = APIRouter()


@router.get("", response_model=list[Customer])
def customers() -> list[Customer]:
    return list_customers()


@router.post("", response_model=Customer)
def add_customer(request: CreateCustomerRequest) -> Customer:
    try:
        return create_customer(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
