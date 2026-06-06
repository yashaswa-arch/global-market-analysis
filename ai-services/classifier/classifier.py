"""Event classification — assigns category labels via Groq."""

from groq_client import groq_complete_json

SYSTEM = """Classify the news event into one category.
Respond ONLY with JSON: {"category": "politics|economy|conflict|disaster|technology|health|environment|other"}"""


async def classify_event(title: str, content: str) -> str:
    data = await groq_complete_json(
        SYSTEM,
        f"Title: {title}\n\nContent:\n{content[:4000]}",
    )
    return data.get("category", "other")
