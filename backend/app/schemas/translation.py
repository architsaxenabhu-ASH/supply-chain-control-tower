from pydantic import BaseModel


# Translation Memory (Phase 6 — Document Intelligence). Translate once, store
# forever, reuse automatically. Governed by the App Manager; every change is
# audited under module "translation".
class TranslationEntry(BaseModel):
    key: str  # normalised source text (lowercased, trimmed)
    source_text: str
    source_language: str  # ISO-ish code or name, e.g. "it", "de", "Italian"
    target_text: str
    target_language: str = "en"
    document_type: str | None = None
    times_reused: int = 0
    updated_by: str | None = None
    updated_at: str


class SaveTranslationRequest(BaseModel):
    source_text: str
    source_language: str
    target_text: str
    target_language: str = "en"
    document_type: str | None = None
    actor: str | None = None
