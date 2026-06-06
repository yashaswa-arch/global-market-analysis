from fastapi import APIRouter, Query

from app.models.schemas import EventsListResponse, NewsFetchStats
from app.services.news_service import NewsService

router = APIRouter()
news_service = NewsService()


@router.post("/fetch", response_model=NewsFetchStats)
async def trigger_news_fetch() -> NewsFetchStats:
    """Manually trigger RSS + GNews collection."""
    return await news_service.collect_all()


@router.get("", response_model=EventsListResponse)
async def list_events(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> EventsListResponse:
    """List latest events with pagination."""
    result = news_service.list_events(limit=limit, offset=offset)
    return EventsListResponse(**result)


@router.get("/unanalyzed", response_model=EventsListResponse)
async def list_unanalyzed_events(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> EventsListResponse:
    """List events waiting for AI analysis (is_analyzed = false)."""
    result = news_service.list_unanalyzed(limit=limit, offset=offset)
    return EventsListResponse(**result)
