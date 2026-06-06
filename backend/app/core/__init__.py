"""Core cross-cutting concerns."""

from app.core.exceptions import SupabaseConnectionError, SupabaseQueryError

__all__ = ["SupabaseConnectionError", "SupabaseQueryError"]
