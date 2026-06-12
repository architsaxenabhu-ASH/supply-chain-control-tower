from pydantic import BaseModel, Field


class CurrencyRateSet(BaseModel):
    rate_date: str  # business date the rates are locked to (YYYY-MM-DD)
    base_currency: str  # ISO code the stored amounts are kept in
    rates: dict[str, float]  # 1 unit of base buys rates[code] units of code
    source: str  # "ecb_reference_1600cet" or "manual"
    locked_at: str
    updated_by: str | None = None
    note: str | None = None


class SaveCurrencyRatesRequest(BaseModel):
    rate_date: str
    base_currency: str = "INR"
    rates: dict[str, float] = Field(default_factory=dict)
    source: str = "manual"
    actor: str | None = None
    reason: str | None = None
