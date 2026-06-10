from fastapi import APIRouter

from app.schemas.business_intelligence import (
    CarrierIntelligence,
    CustomerIntelligence,
    DocumentIntelligence,
    RelationshipMap,
    SupplierIntelligence,
)
from app.services.business_intelligence import (
    carrier_intelligence,
    customer_intelligence,
    document_intelligence,
    document_relationships,
    supplier_intelligence,
    supplier_relationships,
)

supplier_router = APIRouter()
carrier_router = APIRouter()
customer_router = APIRouter()
document_router = APIRouter()
relationships_router = APIRouter()


@supplier_router.get("", response_model=list[SupplierIntelligence])
def suppliers() -> list[SupplierIntelligence]:
    return supplier_intelligence()


@carrier_router.get("", response_model=list[CarrierIntelligence])
def carriers() -> list[CarrierIntelligence]:
    return carrier_intelligence()


@customer_router.get("", response_model=list[CustomerIntelligence])
def customers() -> list[CustomerIntelligence]:
    return customer_intelligence()


@document_router.get("", response_model=list[DocumentIntelligence])
def documents() -> list[DocumentIntelligence]:
    return document_intelligence()


@relationships_router.get("/document/{document_id}", response_model=RelationshipMap)
def document_map(document_id: str) -> RelationshipMap:
    return document_relationships(document_id)


@relationships_router.get("/supplier/{supplier_name}", response_model=RelationshipMap)
def supplier_map(supplier_name: str) -> RelationshipMap:
    return supplier_relationships(supplier_name)
