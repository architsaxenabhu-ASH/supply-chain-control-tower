from fastapi import APIRouter, HTTPException, Query

from app.schemas.translation import SaveTranslationRequest, TranslationEntry
from app.services.translation_repository import (
    list_translations,
    lookup_translation,
    record_reuse,
    save_translation,
)

router = APIRouter()


@router.get("/memory", response_model=list[TranslationEntry])
def memory(limit: int = Query(default=200, ge=1, le=1000)) -> list[TranslationEntry]:
    return list_translations(limit=limit)


@router.get("/lookup", response_model=TranslationEntry)
def lookup(text: str = Query(...), language: str = Query(...)) -> TranslationEntry:
    found = lookup_translation(text, language)
    if found is None:
        raise HTTPException(status_code=404, detail="No stored translation for this phrase.")
    record_reuse(text, language)
    return found


@router.post("/memory", response_model=TranslationEntry)
def save(request: SaveTranslationRequest) -> TranslationEntry:
    try:
        return save_translation(request)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
