from fastapi import APIRouter

from app.database.supabase_client import validate_supabase_connection
from app.models.schemas import TestDbResponse

router = APIRouter()


async def test_database_connection() -> TestDbResponse:
    """
    Verify Supabase connectivity by reading from the `events` table.

    Returns connection status, row count, and a sample row (if any exist).
    """
    result = validate_supabase_connection()

    return TestDbResponse(
        connected=result["connected"],
        table=result["table"],
        total_rows=result["total_rows"],
        sample=result["sample"],
        message="Successfully connected to Supabase and read from events table",
    )
