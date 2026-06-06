from fastapi import APIRouter

from app.routes import analysis, auth, chat, database, events

api_router = APIRouter()

api_router.include_router(database.router, tags=["database"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(events.router, prefix="/events", tags=["events"])
api_router.include_router(analysis.router, prefix="/analysis", tags=["analysis"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
