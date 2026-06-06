import logging
from functools import lru_cache
from typing import Any

from supabase import Client, create_client

from app.config.settings import get_settings
from app.core.exceptions import SupabaseConnectionError, SupabaseQueryError

logger = logging.getLogger(__name__)

EVENTS_TABLE = "events"


def _mask_key(key: str) -> str:
    """Return a safe key preview for logs (never log the full key)."""
    if len(key) <= 8:
        return "***"
    return f"{key[:8]}..."


def log_supabase_startup() -> None:
    """Log Supabase configuration at application startup."""
    settings = get_settings()

    if not settings.supabase_configured:
        logger.warning(
            "Supabase not configured. Set SUPABASE_URL and SUPABASE_KEY in your .env file."
        )
        return

    logger.info("Loaded Supabase URL: %s", settings.supabase_url)
    logger.info("Supabase key loaded successfully (prefix: %s)", _mask_key(settings.supabase_key))


@lru_cache
def get_supabase() -> Client:
    """
    Return a cached Supabase client.

    Uses only SUPABASE_URL and SUPABASE_KEY from environment variables.
    """
    settings = get_settings()

    if not settings.supabase_configured:
        raise SupabaseConnectionError(
            "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in your .env file."
        )

    try:
        return create_client(settings.supabase_url, settings.supabase_key)
    except Exception as exc:
        logger.exception("Failed to create Supabase client")
        raise SupabaseConnectionError(f"Failed to create Supabase client: {exc}") from exc


def validate_supabase_connection() -> dict[str, Any]:
    """
    Validate connectivity by executing a lightweight read against the events table.

    Returns metadata about the connection test. Raises SupabaseConnectionError or
    SupabaseQueryError on failure.
    """
    client = get_supabase()

    try:
        response = client.table(EVENTS_TABLE).select("*", count="exact").limit(1).execute()
    except SupabaseConnectionError:
        raise
    except Exception as exc:
        logger.exception("Supabase connection validation failed")
        raise SupabaseConnectionError(f"Unable to reach Supabase: {exc}") from exc

    if response.count is None and not response.data:
        logger.warning("Connected to Supabase but events table returned no metadata")

    return {
        "connected": True,
        "table": EVENTS_TABLE,
        "total_rows": response.count if response.count is not None else len(response.data),
        "sample": response.data[:1],
    }
