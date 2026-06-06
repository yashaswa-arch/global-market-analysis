import logging
import re
import sys
from pathlib import Path
from typing import Any

from app.config.settings import get_settings
from app.core.exceptions import SupabaseQueryError
from app.database.supabase_client import get_supabase
from app.models.schemas import AssetConsensusSummary, ChatAskResponse, ChatSource, EventOutlookSummary
from app.services.chat_retrieval import RetrievalResult, retrieve_events
from app.services.consensus import (
    build_asset_consensus,
    format_consensus_context,
)

logger = logging.getLogger(__name__)

AI_SERVICES_ROOT = Path(__file__).resolve().parents[3] / "ai-services"
if str(AI_SERVICES_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_SERVICES_ROOT))

from chatbot.chatbot import generate_reply  # noqa: E402

ANALYSIS_TABLE = "analysis"
CHAT_HISTORY_TABLE = "chat_history"

STOPWORDS = {
    "a",
    "an",
    "the",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "can",
    "to",
    "of",
    "in",
    "on",
    "at",
    "for",
    "with",
    "about",
    "how",
    "what",
    "when",
    "where",
    "who",
    "why",
    "which",
    "and",
    "or",
    "but",
    "if",
    "from",
    "this",
    "that",
    "these",
    "those",
    "it",
    "its",
    "they",
    "them",
    "their",
    "we",
    "our",
    "you",
    "your",
    "he",
    "she",
    "his",
    "her",
    "as",
    "by",
    "into",
    "through",
    "during",
    "before",
    "after",
    "above",
    "below",
    "between",
    "under",
    "over",
    "not",
    "no",
    "yes",
    "so",
    "than",
    "too",
    "very",
    "just",
    "also",
    "only",
    "own",
    "same",
    "such",
    "then",
    "there",
    "here",
    "all",
    "any",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "much",
    "many",
    "well",
    "india",
    "indian",
    "global",
    "world",
    "news",
    "event",
    "events",
    "affect",
    "affects",
    "affecting",
    "impact",
    "impacts",
}


class ChatService:
    """Answers questions using analyzed events as context."""

    def __init__(self) -> None:
        self.settings = get_settings()
        self.db = get_supabase()

    async def ask(self, question: str, *, user_id: str | None = None) -> ChatAskResponse:
        if not self.settings.groq_configured:
            raise ValueError("GROQ_API_KEY is not configured")

        normalized_question = question.strip()
        logger.info("Chat question received", extra={"length": len(normalized_question)})

        retrieval = self._search_relevant_events(normalized_question)
        relevant_rows = retrieval.selected

        consensus_list = build_asset_consensus(
            relevant_rows, retrieval.intent.detected_assets
        )
        consensus_block = format_consensus_context(consensus_list)
        event_context = self._build_context(
            relevant_rows, retrieval.intent.detected_assets
        )
        context = (
            f"{consensus_block}\n\n{event_context}"
            if consensus_block
            else event_context
        )

        sources = self._build_sources(relevant_rows)
        consensus_response = self._build_consensus_response(consensus_list)

        logger.info(
            "Chat context built",
            extra={
                "events_used": len(relevant_rows),
                "context_chars": len(context),
                "direct_evidence": retrieval.direct_evidence,
                "inference_mode": retrieval.inference_mode,
                "detected_assets": sorted(retrieval.intent.detected_assets),
                "consensus_assets": [item.asset for item in consensus_list],
            },
        )

        answer = await generate_reply(
            normalized_question,
            context,
            direct_evidence=retrieval.direct_evidence,
            inference_mode=retrieval.inference_mode,
            detected_assets=sorted(retrieval.intent.detected_assets),
            has_consensus=bool(consensus_list),
        )

        resolved_user_id = user_id or self.settings.chat_default_user_id
        if resolved_user_id:
            self._store_conversation(resolved_user_id, normalized_question, answer)
        else:
            logger.warning(
                "Chat history not stored — set CHAT_DEFAULT_USER_ID or pass user_id"
            )

        return ChatAskResponse(
            answer=answer,
            sources=sources,
            direct_evidence=retrieval.direct_evidence,
            inference_mode=retrieval.inference_mode,
            detected_assets=sorted(retrieval.intent.detected_assets),
            query_type=retrieval.intent.query_type.value,
            events_used=len(relevant_rows),
            consensus=consensus_response,
        )

    @staticmethod
    def _build_consensus_response(
        consensus_list,
    ) -> list[AssetConsensusSummary]:
        results: list[AssetConsensusSummary] = []
        for item in consensus_list:
            results.append(
                AssetConsensusSummary(
                    asset=item.asset,
                    overall_outlook=item.overall_outlook,
                    weighted_confidence=item.weighted_confidence,
                    reasoning=item.reasoning,
                    supporting_events=[
                        EventOutlookSummary(
                            title=event.title,
                            outlook=event.outlook,
                            confidence=event.confidence,
                            reason=event.reason,
                        )
                        for event in item.supporting_events
                    ],
                    conflicting_events=[
                        EventOutlookSummary(
                            title=event.title,
                            outlook=event.outlook,
                            confidence=event.confidence,
                            reason=event.reason,
                        )
                        for event in item.conflicting_events
                    ],
                )
            )
        return results

    def _search_relevant_events(self, question: str):
        keywords = self._extract_keywords(question)
        fetch_limit = max(self.settings.chat_max_context_events * 10, 50)

        try:
            response = (
                self.db.table(ANALYSIS_TABLE)
                .select(
                    "*, events(id, title, description, url, source, published_at)",
                )
                .order("generated_at", desc=True)
                .limit(fetch_limit)
                .execute()
            )
        except Exception as exc:
            logger.exception("Failed to fetch analysis for chat context")
            raise SupabaseQueryError(
                f"Failed to fetch analysis for chat: {exc}", table=ANALYSIS_TABLE
            ) from exc

        rows = response.data or []
        if not rows:
            logger.warning("No analyzed events available for chat context")
            from app.services.asset_intelligence import QueryIntent, QueryType

            return RetrievalResult(
                intent=QueryIntent(query_type=QueryType.GENERAL),
                expanded_terms=keywords,
                ranked=[],
                selected=[],
                direct_evidence=False,
                inference_mode=False,
            )

        return retrieve_events(
            rows,
            question,
            keywords,
            max_events=self.settings.chat_max_context_events,
        )

    def _extract_keywords(self, question: str) -> set[str]:
        tokens = re.findall(r"[a-z0-9/]+", question.lower())
        return {token for token in tokens if len(token) > 2 and token not in STOPWORDS}

    def _build_context(
        self, rows: list[dict[str, Any]], asset_terms: set[str]
    ) -> str:
        if not rows:
            return "No analyzed events are available in the database yet."

        parts: list[str] = []
        total_chars = 0
        max_chars = self.settings.chat_max_context_chars

        for index, row in enumerate(rows, start=1):
            block = self._format_event_block(index, row, asset_terms)
            if parts and total_chars + len(block) > max_chars:
                break
            parts.append(block)
            total_chars += len(block)

        return "\n\n".join(parts)

    def _format_event_block(
        self,
        index: int,
        row: dict[str, Any],
        asset_terms: set[str],
    ) -> str:
        event = row.get("events") or {}
        key_points = row.get("key_points") or []
        if isinstance(key_points, list):
            points_text = "; ".join(str(point) for point in key_points[:4])
        else:
            points_text = str(key_points)

        sectors = row.get("affected_sectors") or []
        if isinstance(sectors, list):
            sectors_text = ", ".join(str(sector) for sector in sectors[:5])
        else:
            sectors_text = str(sectors)

        market_lines = self._format_market_impacts(
            row.get("market_impacts"), asset_terms
        )

        lines = [
            f"Event {index}:",
            f"Title: {event.get('title') or 'Unknown'}",
            f"Source: {event.get('source') or 'Unknown'}",
            f"Category: {row.get('category') or 'unknown'}",
            f"Summary: {row.get('summary') or ''}",
            f"Impact on India: {row.get('impact_on_india') or ''}",
            f"Impact type: {row.get('impact_type') or 'neutral'}",
            f"Risk level: {row.get('risk_level') or 'unknown'}",
            f"Affected sectors: {sectors_text or 'none'}",
            f"Key points: {points_text or 'none'}",
        ]
        if market_lines:
            lines.append("Market impacts:")
            lines.extend(market_lines)
        return "\n".join(lines)

    def _format_market_impacts(
        self, market_impacts: Any, asset_terms: set[str]
    ) -> list[str]:
        if not isinstance(market_impacts, list) or not market_impacts:
            return []

        lines: list[str] = []
        prioritized = sorted(
            market_impacts,
            key=lambda item: (
                0
                if isinstance(item, dict)
                and str(item.get("asset") or "") in asset_terms
                else 1
            ),
        )
        for impact in prioritized[:8]:
            if not isinstance(impact, dict):
                continue
            asset = str(impact.get("asset") or "Unknown")
            outlook = str(impact.get("outlook") or "neutral")
            confidence = impact.get("confidence", "")
            reason = str(impact.get("reason") or "")
            lines.append(
                f"- {asset}: {outlook} (confidence {confidence}) — {reason}"
            )
        return lines

    def _build_sources(self, rows: list[dict[str, Any]]) -> list[ChatSource]:
        sources: list[ChatSource] = []
        for row in rows:
            event = row.get("events") or {}
            sources.append(
                ChatSource(
                    event_id=str(row.get("event_id") or event.get("id") or ""),
                    title=event.get("title"),
                    url=event.get("url"),
                    category=row.get("category"),
                    summary=row.get("summary"),
                )
            )
        return sources

    def _store_conversation(self, user_id: str, question: str, answer: str) -> None:
        try:
            self.db.table(CHAT_HISTORY_TABLE).insert(
                [
                    {"user_id": user_id, "role": "user", "message": question},
                    {"user_id": user_id, "role": "assistant", "message": answer},
                ]
            ).execute()
            logger.info("Chat conversation stored", extra={"user_id": user_id})
        except Exception as exc:
            logger.exception("Failed to store chat history")
            raise SupabaseQueryError(
                f"Failed to store chat history: {exc}", table=CHAT_HISTORY_TABLE
            ) from exc
