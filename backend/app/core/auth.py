"""Backend JWT authentication dependencies (V-01 fix).

These FastAPI dependencies validate the Supabase JWT token supplied by the
frontend in the ``Authorization: Bearer <token>`` header.

Usage
-----
Required auth (raises 401 if missing/invalid)::

    @router.get("/protected")
    async def handler(user: AuthUser = Depends(get_current_user)):
        return {"user_id": user["id"]}

Optional auth (returns None if no token)::

    @router.get("/semi-public")
    async def handler(user: AuthUser | None = Depends(get_optional_user)):
        ...
"""

import logging

from fastapi import Depends, Header, HTTPException
from typing import Annotated, TypedDict

from app.config.settings import get_settings
from app.database.supabase_client import get_supabase

logger = logging.getLogger(__name__)


class AuthUser(TypedDict):
    """Slim user payload extracted from a verified Supabase JWT."""

    id: str
    email: str


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser:
    """Validate the Bearer token and return the authenticated user.

    Raises
    ------
    HTTPException 401
        If the header is missing, malformed, or the token is invalid/expired.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Missing or invalid Authorization header. Expected: Bearer <token>",
        )

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty bearer token")

    settings = get_settings()
    if not settings.supabase_configured:
        logger.error("Supabase not configured — cannot validate JWT")
        raise HTTPException(status_code=503, detail="Authentication service unavailable")

    try:
        client = get_supabase()
        user_response = client.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        user = user_response.user
        return AuthUser(id=str(user.id), email=str(user.email or ""))
    except HTTPException:
        raise
    except Exception:
        logger.exception("Token validation failed")
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_optional_user(
    authorization: Annotated[str | None, Header()] = None,
) -> AuthUser | None:
    """Like ``get_current_user`` but returns ``None`` instead of raising 401.

    Use this on endpoints that work both anonymously and with a logged-in user
    (e.g. public event feed that also stores history when authenticated).
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None


async def require_admin(
    user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    """Require the caller to be an authenticated admin user (V-02 fix).

    Admin UUIDs are configured via the ``ADMIN_USER_IDS`` environment variable
    (comma-separated Supabase user UUIDs).

    Raises
    ------
    HTTPException 403
        If the authenticated user is not in the admin list.
    HTTPException 503
        If ``ADMIN_USER_IDS`` is not configured (fail-safe — prevents accidental
        open access when the env var is missing).
    """
    settings = get_settings()
    if not settings.admin_configured:
        logger.error(
            "require_admin: ADMIN_USER_IDS is not set — blocking all admin access. "
            "Set ADMIN_USER_IDS=<your-supabase-uuid> in .env to enable admin routes."
        )
        raise HTTPException(
            status_code=503,
            detail="Admin access is not configured. Set ADMIN_USER_IDS in server environment.",
        )
    if user["id"] not in settings.admin_user_ids:
        logger.warning("Admin access denied for user %s", user["id"])
        raise HTTPException(status_code=403, detail="Admin privileges required")
    return user
