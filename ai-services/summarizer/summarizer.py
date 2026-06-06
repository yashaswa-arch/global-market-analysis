"""AI summarization — produces summary and key points via Groq."""

from groq_client import groq_complete_json

SYSTEM = """You are a news analyst. Summarize articles clearly and extract key points.
Respond ONLY with JSON: {"summary": "...", "key_points": ["point1", "point2", "point3"]}"""


async def summarize_event(title: str, content: str) -> str:
    result = await summarize_with_key_points(title, content)
    return result["summary"]


async def summarize_with_key_points(title: str, content: str) -> dict:
    data = await groq_complete_json(
        SYSTEM,
        f"Title: {title}\n\nContent:\n{content[:6000]}",
    )
    return {
        "summary": data.get("summary", title),
        "key_points": data.get("key_points", []),
    }
