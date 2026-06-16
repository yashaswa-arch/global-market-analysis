import logging
from typing import Any
from fastapi import APIRouter, HTTPException

from app.database.supabase_client import get_supabase

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("")
def get_briefings(limit: int = 10, offset: int = 0) -> dict[str, Any]:
    db = get_supabase()
    try:
        response = (
            db.table("daily_briefings")
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return {
            "briefings": response.data,
            "total": response.count if response.count is not None else len(response.data),
        }
    except Exception as e:
        logger.error(f"Error fetching briefings: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch briefings")
