"""Translation Memory store (Phase 6 — Document Intelligence). Translate once,
store forever, reuse automatically. Governed by the App Manager; every save is
audited under module "translation" so the memory has a tamper-evident trace."""

from __future__ import annotations

from datetime import UTC, datetime

from app.db.local_persistence import load_collection, record_audit_event, save_collection
from app.schemas.translation import SaveTranslationRequest, TranslationEntry


def _normalise(text: str) -> str:
    return " ".join(text.strip().lower().split())


def _key(source_text: str, source_language: str) -> str:
    return f"{source_language.strip().lower()}|{_normalise(source_text)}"


def _load() -> list[TranslationEntry]:
    return load_collection("translation_memory", lambda payload: TranslationEntry(**payload))


def _save(records: list[TranslationEntry]) -> None:
    save_collection("translation_memory", records, lambda record: record.key)


def list_translations(limit: int = 200) -> list[TranslationEntry]:
    records = sorted(_load(), key=lambda record: record.updated_at, reverse=True)
    return records[:limit]


def lookup_translation(source_text: str, source_language: str) -> TranslationEntry | None:
    wanted = _key(source_text, source_language)
    for record in _load():
        if record.key == wanted:
            return record
    return None


def save_translation(request: SaveTranslationRequest) -> TranslationEntry:
    if not request.source_text.strip():
        raise ValueError("Source text is required.")
    if not request.target_text.strip():
        raise ValueError("Translation is required.")
    key = _key(request.source_text, request.source_language)
    records = _load()
    existing = next((record for record in records if record.key == key), None)
    entry = TranslationEntry(
        key=key,
        source_text=request.source_text.strip(),
        source_language=request.source_language.strip(),
        target_text=request.target_text.strip(),
        target_language=(request.target_language or "en").strip(),
        document_type=request.document_type,
        times_reused=existing.times_reused if existing else 0,
        updated_by=request.actor,
        updated_at=datetime.now(UTC).isoformat(),
    )
    _save([entry, *[record for record in records if record.key != key]])
    record_audit_event(
        action="translation_saved" if existing is None else "translation_updated",
        module_name="translation",
        entity_name="translation_memory",
        entity_id=key,
        actor=request.actor,
        old_value=existing,
        new_value=entry,
    )
    return entry


def record_reuse(source_text: str, source_language: str) -> TranslationEntry | None:
    """Bump the reuse counter when a stored translation is applied again —
    the memory's value compounds the more it is reused."""
    key = _key(source_text, source_language)
    records = _load()
    existing = next((record for record in records if record.key == key), None)
    if existing is None:
        return None
    updated = existing.model_copy(update={"times_reused": existing.times_reused + 1})
    _save([updated, *[record for record in records if record.key != key]])
    return updated
