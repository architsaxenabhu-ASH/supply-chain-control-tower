"""Exchange-rate store (Phase 5D/5G). One locked rate set per business date,
per rate book — the end-of-day reference rate (ECB, published ~16:00 CET) or
a manual override. Two books exist because the business runs two flows with
their own rates: "primary" (Meril India → subsidiary; also values inventory)
and "secondary" (subsidiary → customer). Every save is audited under module
"currency" so overrides leave a tamper-evident trace in monitoring."""

from __future__ import annotations

from datetime import UTC, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.currency import RATE_BOOKS, CurrencyRateSet, SaveCurrencyRatesRequest


def _normalize_book(book: str | None) -> str:
    value = (book or "primary").strip().lower()
    return value if value in RATE_BOOKS else "primary"


def _load() -> list[CurrencyRateSet]:
    return load_collection("currency_rates", lambda payload: CurrencyRateSet(**payload))


def _key(rate_set: CurrencyRateSet) -> str:
    return f"{rate_set.rate_date}|{rate_set.base_currency.upper()}|{_normalize_book(rate_set.book)}"


def _save(records: list[CurrencyRateSet]) -> None:
    save_collection("currency_rates", records, _key)


def list_rate_sets(limit: int = 30, book: str | None = None) -> list[CurrencyRateSet]:
    records = _load()
    if book is not None:
        wanted = _normalize_book(book)
        records = [record for record in records if _normalize_book(record.book) == wanted]
    records = sorted(records, key=lambda record: record.rate_date, reverse=True)
    return records[:limit]


def get_rate_set(
    rate_date: str, base_currency: str = "INR", book: str = "primary"
) -> CurrencyRateSet | None:
    wanted = f"{rate_date}|{base_currency.upper()}|{_normalize_book(book)}"
    for record in _load():
        if _key(record) == wanted:
            return record
    return None


def save_rate_set(request: SaveCurrencyRatesRequest) -> CurrencyRateSet:
    base = request.base_currency.strip().upper()
    book = _normalize_book(request.book)
    rates = {
        code.strip().upper(): float(value)
        for code, value in request.rates.items()
        if code.strip() and float(value) > 0
    }
    if not rates:
        raise ValueError("At least one positive exchange rate is required.")
    source = (request.source or "manual").strip().lower()
    rate_set = CurrencyRateSet(
        rate_date=request.rate_date,
        base_currency=base,
        rates=rates,
        source=source,
        book=book,
        locked_at=datetime.now(UTC).isoformat(),
        updated_by=request.actor,
        note=request.reason,
    )
    previous = get_rate_set(request.rate_date, base, book)
    records = [record for record in _load() if _key(record) != _key(rate_set)]
    _save([rate_set, *records])
    record_audit_event(
        action="rates_locked" if previous is None and source != "manual" else "rates_overridden",
        module_name="currency",
        entity_name="exchange_rates",
        entity_id=f"{book}:{rate_set.rate_date}:{base}",
        actor=request.actor,
        reason=request.reason,
        old_value=previous,
        new_value=rate_set,
    )
    return rate_set
