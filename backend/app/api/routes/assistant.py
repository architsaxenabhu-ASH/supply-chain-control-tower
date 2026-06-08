from fastapi import APIRouter

from app.schemas.warehouse import AssistantAnswer, AssistantQuery
from app.services.warehouse_repository import answer_assistant_question


router = APIRouter()


@router.post("/query", response_model=AssistantAnswer)
def query_assistant(query: AssistantQuery) -> AssistantAnswer:
    return answer_assistant_question(query.question)

