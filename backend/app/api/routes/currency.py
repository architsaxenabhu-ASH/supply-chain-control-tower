from fastapi import APIRouter, HTTPException, Query

from app.schemas.currency import CurrencyRateSet, SaveCurrencyRatesRequest
from app.services.currency_repository import get_rate_set, list_rate_sets, save_rate_set

router = APIRouter()


@router.get("/rates", response_model=list[CurrencyRateSet])
def rates(limit: int = Query(default=30, ge=1, le=365)) -> list[CurrencyRateSet]:
    return list_rate_sets(limit=limit)


@router.get("/rates/{rate_date}", response_model=CurrencyRateSet)
def rates_for_date(rate_date: str, base: str = Query(default="INR")) -> CurrencyRateSet:
    record = get_rate_set(rate_date, base)
    if record is None:
        raise HTTPException(status_code=404, detail=f"No locked rates for {rate_date}.")
    return record


@router.post("/rates", response_model=CurrencyRateSet)
def save_rates(request: SaveCurrencyRatesRequest) -> CurrencyRateSet:
    try:
        return save_rate_set(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
