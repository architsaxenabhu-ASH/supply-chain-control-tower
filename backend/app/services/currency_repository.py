"""Exchange-rate store (Phase 5D). One locked rate set per business date —
the end-of-day reference rate (ECB, published ~16:00 CET) or a manual
override. Every save is audited under module "currency" so overrides leave
a tamper-evident trace in monitoring."""

from __future__ import annotations

from datetime import UTC, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.currency import CurrencyRateSet, SaveCurrencyRatesRequest


def _load() -> list[CurrencyRateSet]:
    return load_collection("currency_rates", lambda payload: CurrencyRateSet(**payload))


def _key(rate_set: CurrencyRateSet) -> str:
    return f"{rate_set.rate_date}|{rate_set.base_currency.upper()}"


def _save(records: list[CurrencyRateSet]) -> None:
    save_collection("currency_rates", records, _key)


def list_rate_sets(limit: int = 30) -> list[CurrencyRateSet]:
    records = sorted(_load(), key=lambda record: record.rate_date, reverse=True)
    return records[:limit]


def get_rate_set(rate_date: str, base_currency: str = "INR") -> CurrencyRateSet | None:
    wanted = f"{rate_date}|{base_currency.upper()}"
    for record in _load():
        if _key(record) == wanted:
            return record
    return None


def save_rate_set(request: SaveCurrencyRatesRequest) -> CurrencyRateSet:
    base = request.base_currency.strip().upper()
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
        locked_at=datetime.now(UTC).isoformat(),
        updated_by=request.actor,
        note=request.reason,
    )
    previous = get_rate_set(request.rate_date, base)
    records = [record for record in _load() if _key(record) != _key(rate_set)]
    _save([rate_set, *records])
    record_audit_event(
        action="rates_locked" if previous is None and source != "manual" else "rates_overridden",
        module_name="currency",
        entity_name="exchange_rates",
        entity_id=f"{rate_set.rate_date}:{base}",
        actor=request.actor,
        reason=request.reason,
        old_value=previous,
        new_value=rate_set,
    )
    return rate_set
