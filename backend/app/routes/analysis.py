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

@router.post("/{event_id}/generate")
async def generate_analysis(event_id: str):
    """Force generate deep analysis for a specific event."""
    # We trigger run_analysis and just pass. Wait, let's implement a specific method in the service.
    return await analysis_service.run_analysis_for_event(event_id)


@router.get("/", response_model=AnalysisListResponse)
async def list_analysis(
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> AnalysisListResponse:
    """Return analyzed events with India-focused intelligence fields."""
    result = analysis_service.list_analysis(limit=limit, offset=offset)
    return AnalysisListResponse(**result)
