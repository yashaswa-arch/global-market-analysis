"""Aggregate market impact consensus across retrieved events."""

import logging
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

OUTLOOK_SCORES = {"bullish": 1, "neutral": 0, "bearish": -1}


@dataclass
class EventOutlook:
    title: str
    outlook: str
    confidence: float
    reason: str


@dataclass
class AssetConsensus:
    asset: str
    overall_outlook: str
    weighted_confidence: float
    supporting_events: list[EventOutlook] = field(default_factory=list)
    conflicting_events: list[EventOutlook] = field(default_factory=list)
    reasoning: str = ""


def _event_title(row: dict[str, Any]) -> str:
    event = row.get("events") or {}
    return str(event.get("title") or "Unknown event")


def _impacts_for_asset(row: dict[str, Any], asset: str) -> list[dict[str, Any]]:
    impacts = row.get("market_impacts") or []
    if not isinstance(impacts, list):
        return []
    return [
        impact
        for impact in impacts
        if isinstance(impact, dict) and str(impact.get("asset") or "") == asset
    ]


def build_asset_consensus(
    rows: list[dict[str, Any]],
    detected_assets: set[str],
) -> list[AssetConsensus]:
    results: list[AssetConsensus] = []

    for asset in sorted(detected_assets):
        entries: list[EventOutlook] = []
        for row in rows:
            for impact in _impacts_for_asset(row, asset):
                outlook = str(impact.get("outlook") or "neutral").lower()
                if outlook not in OUTLOOK_SCORES:
                    outlook = "neutral"
                confidence = impact.get("confidence", 50)
                try:
                    confidence_f = float(confidence)
                except (TypeError, ValueError):
                    confidence_f = 50.0
                entries.append(
                    EventOutlook(
                        title=_event_title(row),
                        outlook=outlook,
                        confidence=confidence_f,
                        reason=str(impact.get("reason") or ""),
                    )
                )

        if not entries:
            continue

        weighted: dict[str, float] = {"bullish": 0.0, "bearish": 0.0, "neutral": 0.0}
        for entry in entries:
            weighted[entry.outlook] = weighted.get(entry.outlook, 0.0) + entry.confidence

        bullish_w = weighted["bullish"]
        bearish_w = weighted["bearish"]
        neutral_w = weighted["neutral"]
        total_w = bullish_w + bearish_w + neutral_w

        if bullish_w > 0 and bearish_w > 0 and abs(bullish_w - bearish_w) < max(bullish_w, bearish_w) * 0.35:
            overall = "mixed"
        elif bullish_w >= bearish_w and bullish_w >= neutral_w:
            overall = "bullish"
        elif bearish_w >= bullish_w and bearish_w >= neutral_w:
            overall = "bearish"
        else:
            overall = "neutral"

        if overall == "mixed":
            supporting = [e for e in entries if e.outlook == "bullish"]
            conflicting = [e for e in entries if e.outlook == "bearish"]
            reasoning = (
                f"{len(entries)} event(s) mention {asset}: "
                f"{len(supporting)} bullish, {len(conflicting)} bearish — mixed outlook."
            )
        else:
            supporting = [e for e in entries if e.outlook == overall]
            conflicting = [e for e in entries if e.outlook != overall and e.outlook != "neutral"]
            reasoning = (
                f"{len(entries)} event(s) mention {asset}: "
                f"{len(supporting)} supporting ({overall}), "
                f"{len(conflicting)} conflicting, "
                f"weighted outlook {overall}."
            )

        avg_conf = total_w / len(entries) if entries else 0.0

        results.append(
            AssetConsensus(
                asset=asset,
                overall_outlook=overall,
                weighted_confidence=round(avg_conf, 1),
                supporting_events=supporting,
                conflicting_events=conflicting,
                reasoning=reasoning,
            )
        )

        logger.info(
            "Market consensus built",
            extra={
                "asset": asset,
                "overall_outlook": overall,
                "supporting": len(supporting),
                "conflicting": len(conflicting),
            },
        )

    return results


def format_consensus_context(consensus_list: list[AssetConsensus]) -> str:
    if not consensus_list:
        return ""

    lines = ["=== CONSENSUS SUMMARY (aggregate across retrieved events) ==="]
    for item in consensus_list:
        lines.append(f"\nAsset: {item.asset}")
        lines.append(
            f"Overall outlook: {item.overall_outlook} "
            f"(avg confidence {item.weighted_confidence})"
        )
        lines.append(f"Reasoning: {item.reasoning}")

        if item.supporting_events:
            lines.append("Supporting events:")
            for event in item.supporting_events[:4]:
                lines.append(
                    f"  - {event.title}: {event.outlook} "
                    f"(confidence {event.confidence}) — {event.reason}"
                )

        if item.conflicting_events:
            lines.append("Conflicting events:")
            for event in item.conflicting_events[:4]:
                lines.append(
                    f"  - {event.title}: {event.outlook} "
                    f"(confidence {event.confidence}) — {event.reason}"
                )

    lines.append("=== END CONSENSUS ===\n")
    return "\n".join(lines)


def consensus_to_dicts(consensus_list: list[AssetConsensus]) -> list[dict[str, Any]]:
    return [
        {
            "asset": item.asset,
            "overall_outlook": item.overall_outlook,
            "weighted_confidence": item.weighted_confidence,
            "reasoning": item.reasoning,
            "supporting_events": [
                {
                    "title": event.title,
                    "outlook": event.outlook,
                    "confidence": event.confidence,
                    "reason": event.reason,
                }
                for event in item.supporting_events
            ],
            "conflicting_events": [
                {
                    "title": event.title,
                    "outlook": event.outlook,
                    "confidence": event.confidence,
                    "reason": event.reason,
                }
                for event in item.conflicting_events
            ],
        }
        for item in consensus_list
    ]
