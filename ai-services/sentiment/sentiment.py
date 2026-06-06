"""Sentiment analysis — scores news tone via Groq."""

from groq_client import groq_complete_json

SYSTEM = """Analyze news sentiment objectively.
Respond ONLY with JSON: {"label": "positive|negative|neutral|mixed", "score": -1.0 to 1.0}"""


async def analyze_sentiment(title: str, summary: str) -> dict:
    data = await groq_complete_json(
        SYSTEM,
        f"Title: {title}\nSummary: {summary}",
    )
    return {
        "label": data.get("label", "neutral"),
        "score": float(data.get("score", 0)),
    }
