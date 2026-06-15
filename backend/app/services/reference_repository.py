"""Reference lookups assembled from live business data.

The application never hardcodes the list of countries — countries are *learned*
as they appear in real records (warehouses, customers, shipments, imports,
secondary shipments, country document rules, master data, and user scopes).
`list_known_countries` unions every place a country can appear so any country
selector can always offer the full, current list.
"""

from typing import Any

from app.db.local_persistence import load_collection


# Sentinels that mean "no country restriction" rather than a real country.
_SENTINELS = {"all", "all countries", "global", "none", "n/a", "na", "-"}


def _raw(collection: str) -> list[dict[str, Any]]:
    try:
        return load_collection(collection, lambda payload: payload)
    except Exception:
        # A missing or unreadable collection must never break the lookup.
        return []


def _add(seen: dict[str, str], value: Any) -> None:
    if not isinstance(value, str):
        return
    name = value.strip()
    if not name or name.casefold() in _SENTINELS:
        return
    # De-duplicate case-insensitively while keeping the first-seen spelling.
    seen.setdefault(name.casefold(), name)


def list_known_countries() -> list[str]:
    seen: dict[str, str] = {}

    for record in _raw("warehouses"):
        _add(seen, record.get("country"))
    for record in _raw("customers"):
        _add(seen, record.get("country"))
    for record in _raw("shipments"):
        _add(seen, record.get("destination_country"))
    for record in _raw("import_candidates"):
        _add(seen, record.get("destination_country"))
        _add(seen, record.get("origin_country"))
    for record in _raw("secondary_shipments"):
        _add(seen, record.get("country"))
    for record in _raw("country_document_requirement_rules"):
        _add(seen, record.get("country"))
    for record in _raw("consignments"):
        _add(seen, record.get("country"))
    for record in _raw("master_records"):
        if str(record.get("entity_type", "")).casefold() in {"countries", "country"}:
            _add(seen, record.get("code"))
            _add(seen, record.get("name"))
    for record in _raw("security_users"):
        scope = record.get("country_scope")
        if isinstance(scope, list):
            for item in scope:
                _add(seen, item)

    return sorted(seen.values(), key=str.casefold)


def movement_by_country() -> dict[str, int]:
    """How many shipments are touching each country right now — outbound
    customer shipments plus inbound import shipments plus secondary shipments.
    Used by the management dashboards' movement map. Empty dict = zero movement.
    """
    counts: dict[str, int] = {}
    display: dict[str, str] = {}

    def bump(value: Any) -> None:
        if not isinstance(value, str):
            return
        name = value.strip()
        if not name or name.casefold() in _SENTINELS:
            return
        key = name.casefold()
        display.setdefault(key, name)
        counts[key] = counts.get(key, 0) + 1

    for record in _raw("shipments"):
        bump(record.get("destination_country"))
    for record in _raw("import_candidates"):
        bump(record.get("destination_country"))
    for record in _raw("secondary_shipments"):
        bump(record.get("country"))

    return {display[key]: value for key, value in counts.items()}
