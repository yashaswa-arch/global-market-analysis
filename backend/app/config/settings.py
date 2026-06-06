from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]
ROOT_DIR = BACKEND_DIR.parent

ENV_FILES = [
    p for p in (ROOT_DIR / ".env", BACKEND_DIR / ".env") if p.exists()
] or [str(BACKEND_DIR / ".env")]


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=ENV_FILES,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "Global Event Intelligence Platform"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = True
    api_prefix: str = "/api"

    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:5173"]
    )

    supabase_url: str = Field(default="", description="Supabase project URL (SUPABASE_URL)")
    supabase_key: str = Field(default="", description="Supabase API key (SUPABASE_KEY)")

    # News collection
    gnews_api_key: str = Field(default="", description="GNews API key (GNEWS_API_KEY)")
    news_fetch_interval_minutes: int = Field(default=15, description="Scheduler interval")
    gnews_max_articles: int = Field(default=20, description="Max articles per GNews fetch")
    rss_max_articles_per_feed: int = Field(default=25, description="Max articles per RSS feed")
    news_fetch_enabled: bool = Field(default=True, description="Enable scheduled news fetch")

    # Groq AI analysis
    groq_api_key: str = Field(default="", description="Groq API key (GROQ_API_KEY)")
    groq_model: str = Field(
        default="llama-3.3-70b-versatile",
        description="Groq model name (GROQ_MODEL)",
    )
    analysis_batch_size: int = Field(
        default=5,
        description="Max unanalyzed events per analysis run (ANALYSIS_BATCH_SIZE)",
    )

    # AI chat
    chat_max_context_events: int = Field(
        default=5,
        description="Max analyzed events sent to Groq per question (CHAT_MAX_CONTEXT_EVENTS)",
    )
    chat_max_context_chars: int = Field(
        default=6000,
        description="Max context characters for chat prompts (CHAT_MAX_CONTEXT_CHARS)",
    )
    chat_default_user_id: str = Field(
        default="",
        description="Default Supabase auth user UUID for chat_history (CHAT_DEFAULT_USER_ID)",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url.strip() and self.supabase_key.strip())

    @property
    def groq_configured(self) -> bool:
        return bool(self.groq_api_key.strip())


def get_settings() -> Settings:
    return Settings()
