import json
import logging
import re
from typing import Any

from groq_client import groq_complete
from pydantic import ValidationError

from analyzer.prompts import SYSTEM_PROMPT, build_user_prompt
from analyzer.schemas import EventAnalysisResult

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


def _extract_json(raw: str) -> dict[str, Any]:
    text = raw.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        parsed = json.loads(match.group())
        if isinstance(parsed, dict):
            return parsed

    raise json.JSONDecodeError("No JSON object found", text, 0)


async def analyze_event(
    *,
    title: str,
    description: str | None = None,
    source: str | None = None,
    url: str | None = None,
) -> EventAnalysisResult:
    """Call Groq with strict JSON output, retry on invalid JSON or validation errors."""
    user_prompt = build_user_prompt(
        title=title,
        description=description,
        source=source,
        url=url,
    )

    last_error: str | None = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            raw = await groq_complete(SYSTEM_PROMPT, user_prompt, json_mode=True)
            payload = _extract_json(raw)
            result = EventAnalysisResult.model_validate(payload)
            logger.info(
                "Event analysis succeeded",
                extra={
                    "attempt": attempt,
                    "category": result.category,
                    "market_impacts": len(result.market_impacts),
                },
            )
            return result
        except json.JSONDecodeError as exc:
            last_error = f"invalid_json: {exc}"
            logger.warning(
                "Groq returned invalid JSON (attempt %s/%s): %s",
                attempt,
                MAX_RETRIES,
                exc,
            )
        except ValidationError as exc:
            last_error = f"validation_error: {exc}"
            logger.warning(
                "Groq JSON failed validation (attempt %s/%s): %s",
                attempt,
                MAX_RETRIES,
                exc,
            )
        except Exception as exc:
            last_error = f"groq_error: {exc}"
            logger.warning(
                "Groq analysis failed (attempt %s/%s): %s",
                attempt,
                MAX_RETRIES,
                exc,
            )

    raise RuntimeError(last_error or "analysis_failed")
