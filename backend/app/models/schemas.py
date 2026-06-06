from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class NormalizedEvent(BaseModel):
    """Unified format for all news sources before storage."""

    title: str
    description: str | None = None
    source: str
    url: str
    published_at: datetime | None = None


class EventRecord(BaseModel):
    """Represents a row from the Supabase `events` table."""

    id: str
    title: str | None = None
    description: str | None = None
    url: str | None = None
    source: str | None = None
    published_at: datetime | None = None
    created_at: datetime | None = None
    is_analyzed: bool | None = False

    model_config = {"extra": "allow"}


class TestDbResponse(BaseModel):
    status: str = "ok"
    connected: bool
    table: str
    total_rows: int
    sample: list[dict[str, Any]] = Field(default_factory=list)
    message: str


class EventsListResponse(BaseModel):
    events: list[dict[str, Any]]
    total: int
    limit: int
    offset: int


class NewsFetchStats(BaseModel):
    status: str = "ok"
    fetched: int = 0
    inserted: int = 0
    skipped_duplicates: int = 0
    enriched_descriptions: int = 0
    errors: list[str] = Field(default_factory=list)
    sources: dict[str, int] = Field(default_factory=dict)


class AnalysisRunStats(BaseModel):
    status: str = "ok"
    batch_size: int = 5
    processed: int = 0
    analyzed: int = 0
    filtered_irrelevant: int = 0
    failed: int = 0
    errors: list[str] = Field(default_factory=list)


class AnalysisListResponse(BaseModel):
    analysis: list[dict[str, Any]]
    total: int
    limit: int
    offset: int


class ChatAskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=1000)
    user_id: str | None = Field(
        default=None,
        description="Optional Supabase auth user UUID for chat_history storage",
    )


class ChatSource(BaseModel):
    event_id: str
    title: str | None = None
    url: str | None = None
    category: str | None = None
    summary: str | None = None


class EventOutlookSummary(BaseModel):
    title: str | None = None
    outlook: str
    confidence: float | None = None
    reason: str | None = None


class AssetConsensusSummary(BaseModel):
    asset: str
    overall_outlook: str
    weighted_confidence: float
    reasoning: str
    supporting_events: list[EventOutlookSummary] = Field(default_factory=list)
    conflicting_events: list[EventOutlookSummary] = Field(default_factory=list)


class ChatAskResponse(BaseModel):
    answer: str
    sources: list[ChatSource] = Field(default_factory=list)
    direct_evidence: bool = False
    inference_mode: bool = False
    detected_assets: list[str] = Field(default_factory=list)
    query_type: str = "general"
    events_used: int = 0
    consensus: list[AssetConsensusSummary] = Field(default_factory=list)
