from fastapi import APIRouter


router = APIRouter()


@router.get("/queue")
def list_validation_queue() -> dict[str, list[dict[str, str]]]:
    return {"items": []}

