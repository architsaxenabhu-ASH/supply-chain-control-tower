from fastapi import APIRouter, HTTPException

from app.schemas.warehouse import CreateGoodsReceiptRequest, GoodsReceipt, WorkflowResult
from app.services.warehouse_repository import list_goods_receipts, post_goods_receipt


router = APIRouter()


@router.get("", response_model=list[GoodsReceipt])
def goods_receipts() -> list[GoodsReceipt]:
    return list_goods_receipts()


@router.post("/post", response_model=WorkflowResult)
def post_receipt(request: CreateGoodsReceiptRequest) -> WorkflowResult:
    try:
        return post_goods_receipt(request)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
