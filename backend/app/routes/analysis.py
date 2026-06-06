from fastapi import APIRouter, Query

from app.models.schemas import AnalysisListResponse, AnalysisRunStats
from app.services.analysis_service import AnalysisService

router = APIRouter()
analysis_service = AnalysisService()


@router.post("/run", response_model=AnalysisRunStats)
async def run_analysis(
    batch_size: int | None = Query(default=None, ge=1, le=50),
) -> AnalysisRunStats:
    """Manually trigger AI analysis for unanalyzed events."""
    return await analysis_service.run_analysis(batch_size=batch_size)


@router.get("/", response_model=AnalysisListResponse)
async def list_analysis(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> AnalysisListResponse:
    """Return analyzed events with India-focused intelligence fields."""
    result = analysis_service.list_analysis(limit=limit, offset=offset)
    return AnalysisListResponse(**result)
