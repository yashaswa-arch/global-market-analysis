"""Importance scoring — ranks global event significance via Groq."""

from groq_client import groq_complete_json

SYSTEM = """Score the global importance of this news event from 0 to 100.
Consider geopolitical impact, scale, urgency, and economic effect.
Respond ONLY with JSON: {"score": 0-100, "reasoning": "brief explanation"}"""


async def score_importance(
    title: str,
    summary: str,
    category: str | None = None,
) -> dict:
    data = await groq_complete_json(
        SYSTEM,
        f"Title: {title}\nCategory: {category or 'unknown'}\nSummary: {summary}",
    )
    return {
        "score": float(data.get("score", 50)),
        "reasoning": data.get("reasoning", ""),
    }
