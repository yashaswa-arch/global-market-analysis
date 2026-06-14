from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.auth import AuthUser, get_optional_user
from app.main import limiter
from app.models.schemas import ChatAskRequest, ChatAskResponse
from app.services.chat_service import ChatService

router = APIRouter()
chat_service = ChatService()


@router.post("/ask", response_model=ChatAskResponse)
@limiter.limit("10/minute")
async def ask_question(
    request: Request,
    body: ChatAskRequest,
    user: AuthUser | None = Depends(get_optional_user),
) -> ChatAskResponse:
    """Ask a question about global events using analyzed intelligence as context.

    Rate limited to 10 requests/minute per user (or per IP when unauthenticated).
    When authenticated, chat history is stored against the verified JWT user.
    Unauthenticated requests are allowed but history is not persisted (V-02, V-05 fix).
    """
    # user_id always comes from the verified JWT — never from the request body (V-05 fix)
    resolved_user_id = user["id"] if user else None
    try:
        return await chat_service.ask(body.question, user_id=resolved_user_id)
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
