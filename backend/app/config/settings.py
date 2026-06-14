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
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )

    supabase_url: str = Field(default="", description="Supabase project URL (SUPABASE_URL)")
    supabase_key: str = Field(default="", description="Supabase API key (SUPABASE_KEY)")

    # News collection
    gnews_api_key: str = Field(default="", description="GNews API key (GNEWS_API_KEY)")
    news_fetch_interval_minutes: int = Field(default=15, description="Scheduler interval")
    gnews_max_articles: int = Field(default=20, description="Max articles per GNews fetch")
    rss_max_articles_per_feed: int = Field(default=25, description="Max articles per RSS feed")
    news_fetch_enabled: bool = Field(default=True, description="Enable scheduled news fetch")
    marketaux_api_key: str = Field(default="", description="Marketaux API key (MARKETAUX_API_KEY)")
    enable_marketaux: bool = Field(default=True, description="Enable Marketaux fetch (ENABLE_MARKETAUX)")

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
        default=20,
        description="Max analyzed events sent to Groq per question (CHAT_MAX_CONTEXT_EVENTS)",
    )
    chat_max_context_chars: int = Field(
        default=25000,
        description="Max context characters for chat prompts (CHAT_MAX_CONTEXT_CHARS)",
    )
    chat_default_user_id: str = Field(
        default="",
        description="Default Supabase auth user UUID for chat_history (CHAT_DEFAULT_USER_ID)",
    )
    enable_chat_dynamic_fetch: bool = Field(
        default=True,
        description="Allow chat to trigger external news API calls (ENABLE_CHAT_DYNAMIC_FETCH). Set false in production to prevent denial-of-wallet.",
    )

    # Admin access control (V-02)
    admin_user_ids: Annotated[list[str], NoDecode] = Field(
        default_factory=list,
        description="Comma-separated Supabase user UUIDs with admin privileges (ADMIN_USER_IDS)",
    )

    @field_validator("cors_origins", "admin_user_ids", mode="before")
    @classmethod
    def parse_comma_list(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value: bool | str) -> bool:
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"release", "production", "prod", "false", "0", "no", "off"}:
                return False
            if normalized in {"development", "dev", "debug", "true", "1", "yes", "on"}:
                return True
        return value

    @property
    def supabase_configured(self) -> bool:
        return bool(self.supabase_url.strip() and self.supabase_key.strip())

    @property
    def groq_configured(self) -> bool:
        return bool(self.groq_api_key.strip())

    @property
    def admin_configured(self) -> bool:
        """True when at least one admin UUID has been configured."""
        return bool(self.admin_user_ids)


def get_settings() -> Settings:
    return Settings()
