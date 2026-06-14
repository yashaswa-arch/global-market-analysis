from fastapi import APIRouter, Depends, Query, Request

from app.core.auth import AuthUser, require_admin
from app.main import limiter
from app.models.schemas import AnalysisListResponse, AnalysisRunStats
from app.services.analysis_service import AnalysisService

router = APIRouter()
analysis_service = AnalysisService()


@router.post("/run", response_model=AnalysisRunStats)
@limiter.limit("5/hour")
async def run_analysis(
    request: Request,
    batch_size: int | None = Query(default=None, ge=1, le=50),
    _admin: AuthUser = Depends(require_admin),
) -> AnalysisRunStats:
    """Manually trigger AI analysis for unanalyzed events. Admin only (V-02 fix)."""
    return await analysis_service.run_analysis(batch_size=batch_size)


@router.post("/{event_id}/generate")
@limiter.limit("10/hour")
async def generate_analysis(
    event_id: str,
    request: Request,
    _admin: AuthUser = Depends(require_admin),
):
    """Force generate deep analysis for a specific event. Admin only (V-02 fix)."""
    return await analysis_service.run_analysis_for_event(event_id)


@router.get("/", response_model=AnalysisListResponse)
async def list_analysis(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> AnalysisListResponse:
    """Return analyzed events with India-focused intelligence fields."""
    result = analysis_service.list_analysis(limit=limit, offset=offset)
    return AnalysisListResponse(**result)
