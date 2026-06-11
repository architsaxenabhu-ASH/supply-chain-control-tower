from fastapi import APIRouter, HTTPException, Query

from app.schemas.returns import (
    CreateReturnRequest,
    ReturnDashboard,
    ReturnInspectionRequest,
    ReturnRecord,
    ReturnVerificationRequest,
)
from app.services.returns_repository import (
    create_return,
    get_return,
    list_returns,
    record_inspection,
    record_verification,
    return_dashboard,
    return_inspection_queue,
)

returns_router = APIRouter()
inspection_router = APIRouter()
dashboard_router = APIRouter()


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@returns_router.get("", response_model=list[ReturnRecord])
def returns(
    status: str | None = Query(default=None),
    material: str | None = Query(default=None),
) -> list[ReturnRecord]:
    return list_returns(status=status, material=material)


@returns_router.post("", response_model=ReturnRecord)
def create(request: CreateReturnRequest) -> ReturnRecord:
    return _guard(lambda: create_return(request))


@returns_router.get("/{return_id}", response_model=ReturnRecord)
def detail(return_id: str) -> ReturnRecord:
    record = get_return(return_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Return not found: {return_id}")
    return record


@returns_router.post("/{return_id}/inspect", response_model=ReturnRecord)
def inspect(return_id: str, request: ReturnInspectionRequest) -> ReturnRecord:
    return _guard(lambda: record_inspection(return_id, request))


@returns_router.post("/{return_id}/verify", response_model=ReturnRecord)
def verify(return_id: str, request: ReturnVerificationRequest) -> ReturnRecord:
    return _guard(lambda: record_verification(return_id, request))


@inspection_router.get("", response_model=list[ReturnRecord])
def inspection_queue() -> list[ReturnRecord]:
    return return_inspection_queue()


@dashboard_router.get("", response_model=ReturnDashboard)
def dashboard() -> ReturnDashboard:
    return return_dashboard()
