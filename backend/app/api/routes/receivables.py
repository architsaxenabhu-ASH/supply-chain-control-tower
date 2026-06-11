from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.schemas.receivables import (
    CreateReceivableRequest,
    CreditControl,
    CreditOverrideRequest,
    CreditLimit,
    DistributorFinancialScorecard,
    PaymentRisk,
    Receivable,
    ReceivableUploadSummary,
    RecordPaymentRequest,
    SetCreditLimitRequest,
)
from app.services.financial_intelligence import credit_control, distributor_financial_intelligence, payment_risk
from app.services.receivables_repository import (
    create_receivable,
    get_receivable,
    list_receivables,
    record_payment,
    set_credit_limit,
    set_credit_override,
    upload_receivables,
)

receivables_router = APIRouter()
financial_router = APIRouter()
payment_risk_router = APIRouter()
credit_router = APIRouter()


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@receivables_router.get("", response_model=list[Receivable])
def receivables(
    distributor: str | None = Query(default=None),
    status: str | None = Query(default=None),
    country: str | None = Query(default=None),
) -> list[Receivable]:
    return list_receivables(distributor=distributor, status=status, country=country)


@receivables_router.post("", response_model=Receivable)
def create(request: CreateReceivableRequest) -> Receivable:
    return _guard(lambda: create_receivable(request))


@receivables_router.post("/upload", response_model=ReceivableUploadSummary)
async def upload(file: UploadFile = File(...), actor: str = Form(...)) -> ReceivableUploadSummary:
    content = await file.read()
    return upload_receivables(content, actor)


@receivables_router.get("/{receivable_id}", response_model=Receivable)
def detail(receivable_id: str) -> Receivable:
    record = get_receivable(receivable_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Receivable not found: {receivable_id}")
    return record


@receivables_router.post("/{receivable_id}/payment", response_model=Receivable)
def payment(receivable_id: str, request: RecordPaymentRequest) -> Receivable:
    return _guard(lambda: record_payment(receivable_id, request))


@financial_router.get("", response_model=list[DistributorFinancialScorecard])
def financial() -> list[DistributorFinancialScorecard]:
    return distributor_financial_intelligence()


@payment_risk_router.get("", response_model=list[PaymentRisk])
def risk() -> list[PaymentRisk]:
    return payment_risk()


@credit_router.get("", response_model=list[CreditControl])
def credit() -> list[CreditControl]:
    return credit_control()


@credit_router.post("/limit", response_model=CreditLimit)
def limit(request: SetCreditLimitRequest) -> CreditLimit:
    return set_credit_limit(request)


@credit_router.post("/override", response_model=CreditLimit)
def override(request: CreditOverrideRequest) -> CreditLimit:
    return set_credit_override(request.distributor, request.override, request.reason, request.actor)
