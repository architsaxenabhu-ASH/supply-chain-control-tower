from fastapi import APIRouter, HTTPException

from app.schemas.imports import (
    ImportApprovalRequest,
    ImportAssemblyRequest,
    ImportDeliveryRequest,
    ImportFileCandidate,
    ImportGoodsReceiptPostRequest,
    ShipmentPlan,
    ShipmentPlanRequest,
    ShipmentTimeline,
)
from app.schemas.warehouse import WorkflowResult
from app.services.import_repository import (
    approve_import_candidate,
    assemble_import_candidate_from_documents,
    exp_0361_development_fixture,
    get_shipment_timeline,
    latest_import_candidate,
    list_import_candidates,
    mark_import_delivered,
    post_import_goods_receipt,
    save_shipment_plan,
)


router = APIRouter()


@router.get("/latest-preview", response_model=ImportFileCandidate)
def latest_preview() -> ImportFileCandidate:
    return latest_import_candidate()


@router.get("", response_model=list[ImportFileCandidate])
def import_candidates() -> list[ImportFileCandidate]:
    return list_import_candidates()


@router.post("/assemble-from-documents", response_model=ImportFileCandidate)
def assemble_from_documents(request: ImportAssemblyRequest) -> ImportFileCandidate:
    try:
        return assemble_import_candidate_from_documents(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/approve", response_model=ImportFileCandidate)
def approve_import(request: ImportApprovalRequest) -> ImportFileCandidate:
    try:
        return approve_import_candidate(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/mark-delivered", response_model=ImportFileCandidate)
def mark_delivered(request: ImportDeliveryRequest) -> ImportFileCandidate:
    try:
        return mark_import_delivered(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/post-goods-receipt", response_model=WorkflowResult)
def post_goods_receipt_from_import(request: ImportGoodsReceiptPostRequest) -> WorkflowResult:
    try:
        return post_import_goods_receipt(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@router.post("/plan", response_model=ShipmentPlan)
def save_plan(request: ShipmentPlanRequest) -> ShipmentPlan:
    return save_shipment_plan(request)


@router.get("/timeline", response_model=ShipmentTimeline)
def shipment_timeline(import_file_number: str) -> ShipmentTimeline:
    return get_shipment_timeline(import_file_number)


@router.get("/exp-0361-preview", response_model=ImportFileCandidate)
def exp_0361_preview() -> ImportFileCandidate:
    return exp_0361_development_fixture()
