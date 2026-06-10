from fastapi import APIRouter, HTTPException, Query

from app.schemas.exceptions import ExceptionUpdateRequest, OperationalException
from app.services.exception_repository import (
    get_exception,
    list_exceptions,
    scan_exceptions,
    update_exception,
)


router = APIRouter()


@router.get("", response_model=list[OperationalException])
def exceptions(
    severity: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> list[OperationalException]:
    return list_exceptions(severity=severity, status=status)


@router.post("/scan", response_model=list[OperationalException])
def scan() -> list[OperationalException]:
    return scan_exceptions()


@router.get("/{exception_id}", response_model=OperationalException)
def detail(exception_id: str) -> OperationalException:
    exception = get_exception(exception_id)
    if not exception:
        raise HTTPException(status_code=404, detail=f"Exception not found: {exception_id}")
    return exception


@router.patch("/{exception_id}", response_model=OperationalException)
def update(exception_id: str, request: ExceptionUpdateRequest) -> OperationalException:
    try:
        return update_exception(exception_id, request)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error
