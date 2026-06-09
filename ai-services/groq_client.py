import json
import logging
import os
import re
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv
from groq import AsyncGroq

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).resolve().parents[1]
load_dotenv(ROOT_DIR / "backend" / ".env")

DEFAULT_MODEL = "llama-3.3-70b-versatile"


@lru_cache
def get_groq_client() -> AsyncGroq:
    api_key = os.getenv("GROQ_API_KEY", "")
    if not api_key:
        raise ValueError("GROQ_API_KEY is not set in .env")
    return AsyncGroq(api_key=api_key)


async def groq_complete(system: str, user: str, *, json_mode: bool = False) -> str:
    client = get_groq_client()
    model = os.getenv("GROQ_MODEL", DEFAULT_MODEL)
    kwargs: dict = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.2,
        "max_tokens": 2048,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    logger.debug("Calling Groq model=%s json_mode=%s", model, json_mode)
    response = await client.chat.completions.create(**kwargs)
    content = (response.choices[0].message.content or "").strip()
    if not content:
        raise ValueError("Groq returned empty response")
    return content


async def groq_complete_json(system: str, user: str) -> dict:
    raw = await groq_complete(system, user, json_mode=True)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if match:
            return json.loads(match.group())
        raise
