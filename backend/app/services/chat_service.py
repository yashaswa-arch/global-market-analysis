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
from app.services.news_service import NewsService

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

        retrieval = await self._search_relevant_events(normalized_question)
        relevant_rows = retrieval.selected

        logger.warning(
            "Chat debug: retrieval snapshot",
            extra={
                "detected_assets": sorted(retrieval.intent.detected_assets),
                "retrieved_rows": len(relevant_rows),
            },
        )

        for index, row in enumerate(relevant_rows, start=1):
            event = row.get("events") or {}
            market_impacts = row.get("market_impacts")
            market_asset_names = []
            if isinstance(market_impacts, list):
                market_asset_names = [
                    str(impact.get("asset") or "")
                    for impact in market_impacts
                    if isinstance(impact, dict)
                ]

            logger.warning(
                "Chat debug row %s",
                index,
                extra={
                    "event_id": row.get("id"),
                    "title": event.get("title"),
                    "has_market_impacts": isinstance(market_impacts, list) and bool(market_impacts),
                    "market_impact_assets": market_asset_names,
                },
            )

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

    async def _search_relevant_events(self, question: str):
        keywords = self._extract_keywords(question)
        fetch_limit = max(self.settings.chat_max_context_events * 10, 50)

        try:
            # 1. Fetch baseline latest events
            baseline_response = (
                self.db.table(ANALYSIS_TABLE)
                .select("*, events(id, title, description, url, source, published_at)")
                .order("generated_at", desc=True)
                .limit(fetch_limit)
                .execute()
            )
            rows = baseline_response.data or []
            seen_ids = {r.get("event_id") for r in rows if r.get("event_id")}

            # 2. Perform deep search for top keywords to expand context
            sorted_keywords = sorted(list(keywords), key=len, reverse=True)[:3]
            
            deep_search_count = 0
            def do_search(kw: str):
                nonlocal deep_search_count
                search_res = self.db.rpc("search_events_deep", {"query_text": kw, "max_limit": 25, "row_offset": 0}).execute()
                data = search_res.data or []
                deep_search_count += len(data)
                for r in data:
                    event_id = r.get("id")
                    if event_id and event_id not in seen_ids:
                        seen_ids.add(event_id)
                        analysis = r.get("analysis") or {}
                        analysis["events"] = {
                            "id": event_id,
                            "title": r.get("title"),
                            "description": r.get("description"),
                            "source": r.get("source"),
                            "url": r.get("url"),
                            "published_at": r.get("published_at"),
                        }
                        rows.append(analysis)
            
            for kw in sorted_keywords:
                do_search(kw)
                
            if not rows:
                from app.services.asset_intelligence import QueryIntent, QueryType
                return RetrievalResult(
                    intent=QueryIntent(query_type=QueryType.GENERAL),
                    expanded_terms=keywords,
                    ranked=[],
                    selected=[],
                    direct_evidence=False,
                    inference_mode=False,
                )

            retrieval = retrieve_events(
                rows,
                question,
                keywords,
                max_events=self.settings.chat_max_context_events,
            )

            # 3. Optionally fetch from external APIs when local results are thin (V-10 fix)
            # Controlled by ENABLE_CHAT_DYNAMIC_FETCH — set false in production
            # to prevent arbitrary chat queries from triggering paid API calls.
            if self.settings.enable_chat_dynamic_fetch and len(retrieval.selected) < 3 and sorted_keywords:
                logger.info(f"Insufficient events for '{sorted_keywords[0]}' after retrieval filter, dynamically fetching news...")
                news_service = NewsService()
                inserted = await news_service.fetch_targeted_news(sorted_keywords[0], limit=5)
                if inserted > 0:
                    # Re-run search for the top keyword to grab the newly inserted items
                    do_search(sorted_keywords[0])
                    # Re-run retrieval with the newly expanded rows
                    retrieval = retrieve_events(
                        rows,
                        question,
                        keywords,
                        max_events=self.settings.chat_max_context_events,
                    )
            elif not self.settings.enable_chat_dynamic_fetch and len(retrieval.selected) < 3:
                logger.info("Dynamic news fetch is disabled (ENABLE_CHAT_DYNAMIC_FETCH=false). Answering from existing DB events only.")

        except Exception as exc:
            error_msg = str(exc)
            logger.exception("Failed to fetch analysis for chat context")
            if "PGRST202" in error_msg and "search_events_deep" in error_msg:
                raise ValueError("Database schema incomplete: Missing 'search_events_deep' function. Please execute '003_phase9_tables.sql' in your Supabase SQL Editor.")
            raise SupabaseQueryError(
                f"Failed to fetch analysis for chat: {error_msg}", table=ANALYSIS_TABLE
            ) from exc

        return retrieval

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
            f"Why This Matters: {row.get('why_this_matters') or ''}",
            f"Strategic Significance: {row.get('strategic_significance') or ''}",
            f"Impact on India: {row.get('impact_on_india') or ''}",
            f"Impact type: {row.get('impact_type') or 'neutral'}",
            f"Risk level: {row.get('risk_level') or 'unknown'}",
            f"Affected sectors: {sectors_text or 'none'}",
            f"Countries Impacted: {', '.join(row.get('countries_impacted') or []) or 'none'}",
            f"Key points: {points_text or 'none'}",
            f"Bull Case: {row.get('bull_case') or ''}",
            f"Bear Case: {row.get('bear_case') or ''}",
            f"Consensus View: {row.get('consensus_view') or ''}",
            f"Historical Comparisons: {row.get('historical_comparisons') or ''}",
            f"Future Scenarios: {row.get('future_scenarios') or ''}",
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
                {"user_id": user_id, "question": question, "response": answer}
            ).execute()
            logger.info("Chat conversation stored", extra={"user_id": user_id})
        except Exception as exc:
            logger.exception("Failed to store chat history")
            raise SupabaseQueryError(
                f"Failed to store chat history: {exc}", table=CHAT_HISTORY_TABLE
            ) from exc
