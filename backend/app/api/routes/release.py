from fastapi import APIRouter

from app.schemas.release import NotSellableBatch, ReleaseAdvanceRequest, ReleaseRecord
from app.services.release_repository import advance_release, available_not_sellable, list_releases


router = APIRouter()


@router.get("", response_model=list[ReleaseRecord])
def releases() -> list[ReleaseRecord]:
    return list_releases()


@router.post("/advance", response_model=ReleaseRecord)
def advance(request: ReleaseAdvanceRequest) -> ReleaseRecord:
    return advance_release(request)


@router.get("/not-sellable", response_model=list[NotSellableBatch])
def not_sellable() -> list[NotSellableBatch]:
    return available_not_sellable()
