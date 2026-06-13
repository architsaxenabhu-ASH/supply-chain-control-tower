from pydantic import BaseModel, Field


# Two rate books exist because the business runs two flows with their own
# exchange rates: "primary" (Meril India → subsidiary; also values inventory)
# and "secondary" (subsidiary → customer).
RATE_BOOKS = ["primary", "secondary"]


class CurrencyRateSet(BaseModel):
    rate_date: str  # business date the rates are locked to (YYYY-MM-DD)
    base_currency: str  # ISO code the stored amounts are kept in
    rates: dict[str, float]  # 1 unit of base buys rates[code] units of code
    source: str  # "ecb_reference_1600cet" or "manual"
    locked_at: str
    book: str = "primary"
    updated_by: str | None = None
    note: str | None = None


class SaveCurrencyRatesRequest(BaseModel):
    rate_date: str
    base_currency: str = "INR"
    rates: dict[str, float] = Field(default_factory=dict)
    source: str = "manual"
    book: str = "primary"
    actor: str | None = None
    reason: str | None = None
