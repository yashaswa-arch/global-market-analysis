from fastapi import APIRouter, Depends, Query, Request

from app.core.auth import AuthUser, require_admin
from app.main import limiter
from app.models.schemas import EventsListResponse, NewsFetchStats
from app.services.news_service import NewsService

router = APIRouter()
news_service = NewsService()


@router.post("/fetch", response_model=NewsFetchStats)
@limiter.limit("2/hour")
async def trigger_news_fetch(
    request: Request,
    _admin: AuthUser = Depends(require_admin),
) -> NewsFetchStats:
    """Manually trigger RSS + GNews collection. Admin only (V-02 fix)."""
    return await news_service.collect_all()


@router.get("", response_model=EventsListResponse)
async def list_events(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    search_query: str | None = Query(default=None, alias="q"),
    country: str | None = Query(default=None),
    region: str | None = Query(default=None),
    asset: str | None = Query(default=None),
    source: str | None = Query(default=None),
    sector: str | None = Query(default=None),
    risk_level: str | None = Query(default=None),
    from_date: str | None = Query(default=None),
    to_date: str | None = Query(default=None),
    category: str | None = Query(default=None),
    priority: str | None = Query(default=None),
) -> EventsListResponse:
    """List latest events with pagination and filters."""
    result = news_service.list_events(
        limit=limit, 
        offset=offset,
        search_query=search_query,
        country=country,
        region=region,
        asset=asset,
        source=source,
        sector=sector,
        risk_level=risk_level,
        from_date=from_date,
        to_date=to_date,
        category=category,
        priority=priority,
    )
    return EventsListResponse(**result)


@router.get("/unanalyzed", response_model=EventsListResponse)
async def list_unanalyzed_events(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> EventsListResponse:
    """List events waiting for AI analysis (is_analyzed = false)."""
    result = news_service.list_unanalyzed(limit=limit, offset=offset)
    return EventsListResponse(**result)
