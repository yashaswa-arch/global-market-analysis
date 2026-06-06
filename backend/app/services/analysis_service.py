import logging
import sys
from pathlib import Path
from typing import Any

from app.config.settings import get_settings
from app.core.exceptions import SupabaseQueryError
from app.database.supabase_client import EVENTS_TABLE, get_supabase
from app.models.schemas import AnalysisRunStats
from app.services.relevance_filter import is_relevant_event

logger = logging.getLogger(__name__)

AI_SERVICES_ROOT = Path(__file__).resolve().parents[3] / "ai-services"
if str(AI_SERVICES_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICES_ROOT))

from analyzer.engine import analyze_event  # noqa: E402

ANALYSIS_TABLE = "analysis"


class AnalysisService:
    """Runs relevance filtering, Groq analysis, validation, and persistence."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.db = get_supabase()

    async def run_analysis(self, *, batch_size: int | None = None) -> AnalysisRunStats:
        if not self.settings.groq_configured:
            return AnalysisRunStats(
                status="error",
                errors=["GROQ_API_KEY is not configured"],
            )

        limit = batch_size or self.settings.analysis_batch_size
        stats = AnalysisRunStats(batch_size=limit)

        try:
            response = (
                self.db.table(EVENTS_TABLE)
                .select("*")
                .eq("is_analyzed", False)
                .order("created_at", desc=False)
                .limit(limit)
                .execute()
            )
        except Exception as exc:
            logger.exception("Failed to fetch unanalyzed events")
            raise SupabaseQueryError(
                f"Failed to fetch unanalyzed events: {exc}", table=EVENTS_TABLE
            ) from exc

        events = response.data or []
        stats.processed = len(events)

        if not events:
            logger.info("No unanalyzed events to process")
            return stats

        for event in events:
            event_id = event["id"]
            title = event.get("title") or ""
            description = event.get("description")

            relevant, reason = is_relevant_event(title, description)
            if not relevant:
                self._mark_analyzed(event_id)
                stats.filtered_irrelevant += 1
                logger.info(
                    "Event filtered as irrelevant",
                    extra={"event_id": event_id, "reason": reason, "title": title[:80]},
                )
                continue

            try:
                result = await analyze_event(
                    title=title,
                    description=description,
                    source=event.get("source"),
                    url=event.get("url"),
                )
            except Exception as exc:
                stats.failed += 1
                error_msg = f"{event_id}: {exc}"
                stats.errors.append(error_msg)
                logger.error(
                    "Analysis failed after retries — event left unanalyzed",
                    extra={"event_id": event_id, "error": str(exc)},
                )
                continue

            try:
                self._store_analysis(event_id, result.model_dump())
                self._mark_analyzed(event_id)
                stats.analyzed += 1
                logger.info(
                    "Event analyzed and stored",
                    extra={
                        "event_id": event_id,
                        "category": result.category,
                        "importance_score": result.importance_score,
                        "market_impacts": len(result.market_impacts),
                    },
                )
            except Exception as exc:
                stats.failed += 1
                error_msg = f"{event_id}: store_failed: {exc}"
                stats.errors.append(error_msg)
                logger.exception(
                    "Failed to store analysis for event %s",
                    event_id,
                )

        logger.info(
            "Analysis run complete",
            extra={
                "processed": stats.processed,
                "analyzed": stats.analyzed,
                "filtered_irrelevant": stats.filtered_irrelevant,
                "failed": stats.failed,
            },
        )
        return stats

    def list_analysis(self, *, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        try:
            response = (
                self.db.table(ANALYSIS_TABLE)
                .select(
                    "*, events(id, title, description, url, source, published_at)",
                    count="exact",
                )
                .order("generated_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        except Exception as exc:
            logger.exception("Failed to list analysis records")
            raise SupabaseQueryError(
                f"Failed to list analysis: {exc}", table=ANALYSIS_TABLE
            ) from exc

        return {
            "analysis": response.data,
            "total": response.count if response.count is not None else len(response.data),
            "limit": limit,
            "offset": offset,
        }

    def _store_analysis(self, event_id: str, payload: dict[str, Any]) -> None:
        market_impacts = [
            {
                "asset": item["asset"],
                "outlook": item["outlook"],
                "confidence": int(round(item["confidence"])),
                "reason": item["reason"],
            }
            for item in payload.get("market_impacts", [])
        ]
        row = {
            "event_id": event_id,
            "category": payload["category"],
            "summary": payload["summary"],
            "sentiment": payload["sentiment"],
            "importance_score": int(round(payload["importance_score"])),
            "key_points": payload["key_points"],
            "impact_on_india": payload["impact_on_india"],
            "impact_type": payload["impact_type"],
            "affected_sectors": payload["affected_sectors"],
            "risk_level": payload["risk_level"],
            "confidence_score": int(round(payload["confidence_score"])),
            "market_impacts": market_impacts,
        }
        self.db.table(ANALYSIS_TABLE).insert(row).execute()

    def _mark_analyzed(self, event_id: str) -> None:
        self.db.table(EVENTS_TABLE).update({"is_analyzed": True}).eq("id", event_id).execute()
