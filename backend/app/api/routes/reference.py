from fastapi import APIRouter

from app.services.reference_repository import list_known_countries, movement_by_country


router = APIRouter()


@router.get("/countries", response_model=list[str])
def known_countries() -> list[str]:
    """Every country the system currently knows about, learned from live data."""
    return list_known_countries()


@router.get("/movement-by-country", response_model=dict[str, int])
def movement() -> dict[str, int]:
    """Shipment movement count per country (outbound + inbound). Empty = zero."""
    return movement_by_country()
