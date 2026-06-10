from fastapi import APIRouter, HTTPException

from app.schemas.reservations import (
    ExtendReservationRequest,
    ReallocateRequest,
    ReallocationRecord,
    ReleaseReservationRequest,
)
from app.services.reallocation_repository import extend, list_reallocations, reallocate, release


router = APIRouter()


@router.get("", response_model=list[ReallocationRecord])
def reallocations() -> list[ReallocationRecord]:
    return list_reallocations()


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/reallocate", response_model=ReallocationRecord)
def do_reallocate(request: ReallocateRequest) -> ReallocationRecord:
    return _guard(lambda: reallocate(request))


@router.post("/release", response_model=ReallocationRecord)
def do_release(request: ReleaseReservationRequest) -> ReallocationRecord:
    return _guard(lambda: release(request))


@router.post("/extend", response_model=ReallocationRecord)
def do_extend(request: ExtendReservationRequest) -> ReallocationRecord:
    return _guard(lambda: extend(request))
