from fastapi import APIRouter, HTTPException

from app.models.schemas import ChatAskRequest, ChatAskResponse
from app.services.chat_service import ChatService

router = APIRouter()
chat_service = ChatService()


@router.post("/ask", response_model=ChatAskResponse)
async def ask_question(body: ChatAskRequest) -> ChatAskResponse:
    """Ask a question about global events using analyzed intelligence as context."""
    try:
        return await chat_service.ask(body.question, user_id=body.user_id)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
