from fastapi import APIRouter, File, Form, HTTPException, Query, UploadFile

from app.schemas.partners import (
    CustomsPartnerIntelligence,
    ExecutiveCommandCenterV3,
    LogisticsPartnerScorecard,
    WarehousePartnerScorecard,
)
from app.schemas.payables import CreatePayableRequest, Payable, PartnerFinancialScorecard, PayablesRisk
from app.schemas.receivables import ReceivableUploadSummary, RecordPaymentRequest
from app.services.partner_intelligence import (
    customs_partner_intelligence,
    executive_command_center_v3,
    logistics_partner_intelligence,
    partner_financial_intelligence,
    payables_risk,
    warehouse_partner_intelligence,
)
from app.services.payables_repository import (
    create_payable,
    get_payable,
    list_payables,
    record_payment,
    upload_payables,
)

payables_router = APIRouter()
partner_financial_router = APIRouter()
payables_risk_router = APIRouter()
logistics_router = APIRouter()
customs_router = APIRouter()
warehouse_partner_router = APIRouter()
command_center_v3_router = APIRouter()


def _guard(call):
    try:
        return call()
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@payables_router.get("", response_model=list[Payable])
def payables(
    partner_name: str | None = Query(default=None),
    partner_type: str | None = Query(default=None),
    status: str | None = Query(default=None),
) -> list[Payable]:
    return list_payables(partner_name=partner_name, partner_type=partner_type, status=status)


@payables_router.post("", response_model=Payable)
def create(request: CreatePayableRequest) -> Payable:
    return _guard(lambda: create_payable(request))


@payables_router.post("/upload", response_model=ReceivableUploadSummary)
async def upload(file: UploadFile = File(...), actor: str = Form(...)) -> ReceivableUploadSummary:
    content = await file.read()
    return upload_payables(content, actor)


@payables_router.get("/{payable_id}", response_model=Payable)
def detail(payable_id: str) -> Payable:
    record = get_payable(payable_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"Payable not found: {payable_id}")
    return record


@payables_router.post("/{payable_id}/payment", response_model=Payable)
def payment(payable_id: str, request: RecordPaymentRequest) -> Payable:
    return _guard(lambda: record_payment(payable_id, request))


@partner_financial_router.get("", response_model=list[PartnerFinancialScorecard])
def partner_financial() -> list[PartnerFinancialScorecard]:
    return partner_financial_intelligence()


@payables_risk_router.get("", response_model=list[PayablesRisk])
def risk() -> list[PayablesRisk]:
    return payables_risk()


@logistics_router.get("", response_model=list[LogisticsPartnerScorecard])
def logistics() -> list[LogisticsPartnerScorecard]:
    return logistics_partner_intelligence()


@customs_router.get("", response_model=CustomsPartnerIntelligence)
def customs() -> CustomsPartnerIntelligence:
    return customs_partner_intelligence()


@warehouse_partner_router.get("", response_model=list[WarehousePartnerScorecard])
def warehouse_partners() -> list[WarehousePartnerScorecard]:
    return warehouse_partner_intelligence()


@command_center_v3_router.get("", response_model=ExecutiveCommandCenterV3)
def command_center_v3() -> ExecutiveCommandCenterV3:
    return executive_command_center_v3()
