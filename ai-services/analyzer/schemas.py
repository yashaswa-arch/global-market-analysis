import re

from pydantic import BaseModel, Field, field_validator

# --- Categories (strict allowlist + alias map) ---

ALLOWED_CATEGORIES = {
    "geopolitics",
    "economy",
    "trade",
    "energy",
    "technology",
    "defense",
    "supply_chains",
    "conflict",
    "international_relations",
    "environment",
    "healthcare",
    "education",
    "hospitality",
    "tourism",
    "agriculture",
    "finance",
    "legal",
    "science",
    "infrastructure",
    "other",
}

CATEGORY_ALIASES: dict[str, str] = {
    "environmental": "environment",
    "climate": "environment",
    "climate_change": "environment",
    "health": "healthcare",
    "medical": "healthcare",
    "public_health": "healthcare",
    "schools": "education",
    "travel": "tourism",
    "hotels": "hospitality",
    "farming": "agriculture",
    "financial": "finance",
    "banking_policy": "finance",
    "monetary_policy": "finance",
    "crime": "legal",
    "judiciary": "legal",
    "law": "legal",
    "geopolitical": "geopolitics",
    "economic": "economy",
    "tech": "technology",
    "supply_chain": "supply_chains",
    "international": "international_relations",
    "foreign_relations": "international_relations",
    "warfare": "conflict",
    "war": "conflict",
}

CATEGORY_PATTERN = re.compile(r"^[a-z][a-z0-9_]{0,39}$")

ALLOWED_SENTIMENTS = {"positive", "negative", "neutral", "mixed"}
ALLOWED_IMPACT_TYPES = {"positive", "negative", "neutral"}
ALLOWED_RISK_LEVELS = {"low", "medium", "high", "critical"}
ALLOWED_OUTLOOKS = {"bullish", "bearish", "neutral"}

ALLOWED_SECTORS = {
    "Banking",
    "IT",
    "Pharma",
    "Auto",
    "Energy",
    "FMCG",
    "Metals",
    "Hospitality",
    "Tourism",
    "Media",
    "Healthcare",
    "Education",
    "Agriculture",
    "Telecom",
    "Real Estate",
    "Infrastructure",
    "Renewables",
}

ALLOWED_MARKET_ASSETS = {
    "Gold",
    "Silver",
    "Crude Oil",
    "Natural Gas",
    "Nifty",
    "Sensex",
    "Nasdaq",
    "S&P 500",
    "USD/INR",
    *ALLOWED_SECTORS,
}

ASSET_ALIASES: dict[str, str] = {
    "gold": "Gold",
    "silver": "Silver",
    "crude oil": "Crude Oil",
    "crude": "Crude Oil",
    "oil": "Crude Oil",
    "natural gas": "Natural Gas",
    "gas": "Natural Gas",
    "nifty": "Nifty",
    "nifty50": "Nifty",
    "sensex": "Sensex",
    "nasdaq": "Nasdaq",
    "s&p 500": "S&P 500",
    "sp 500": "S&P 500",
    "usd/inr": "USD/INR",
    "usd inr": "USD/INR",
    "usd-inr": "USD/INR",
    "banking": "Banking",
    "it": "IT",
    "pharma": "Pharma",
    "auto": "Auto",
    "energy": "Energy",
    "fmcg": "FMCG",
    "metals": "Metals",
    "hospitality": "Hospitality",
    "tourism": "Tourism",
    "media": "Media",
    "entertainment": "Media",
    "healthcare": "Healthcare",
    "education": "Education",
    "agriculture": "Agriculture",
    "telecom": "Telecom",
    "real estate": "Real Estate",
    "infrastructure": "Infrastructure",
    "renewables": "Renewables",
    "renewable energy": "Renewables",
    "chinese tech stocks": "IT",
    "carbon credits": "Energy",
}

FORBIDDEN_REASON_TERMS = ("buy", "sell", "target price", "guaranteed", "guarantee")


def normalize_category(value: str) -> str:
    cleaned = value.strip()
    if not cleaned or len(cleaned) > 60:
        raise ValueError(f"Invalid category: {value}")

    normalized = cleaned.lower().replace(" ", "_").replace("-", "_")
    normalized = CATEGORY_ALIASES.get(normalized, normalized)

    if not CATEGORY_PATTERN.match(normalized):
        raise ValueError(f"Invalid category: {value}")
    if normalized not in ALLOWED_CATEGORIES:
        raise ValueError(f"Invalid category: {value}")
    return normalized


def normalize_asset(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        raise ValueError("asset cannot be empty")
    key = cleaned.lower().replace("_", " ")
    if key in ASSET_ALIASES:
        return ASSET_ALIASES[key]
    for canonical in ALLOWED_MARKET_ASSETS:
        if cleaned.lower() == canonical.lower():
            return canonical
    raise ValueError(f"Invalid asset: {value}")


def try_normalize_sector(value: str) -> str | None:
    try:
        canonical = normalize_asset(value)
    except ValueError:
        return None
    return canonical if canonical in ALLOWED_SECTORS else None


def try_normalize_market_asset(value: str) -> str | None:
    try:
        return normalize_asset(value)
    except ValueError:
        return None


class MarketImpactItem(BaseModel):
    asset: str
    outlook: str
    confidence: float = Field(ge=0, le=100)
    reason: str = Field(min_length=5, max_length=300)

    @field_validator("asset")
    @classmethod
    def validate_asset(cls, value: str) -> str:
        canonical = try_normalize_market_asset(value)
        if not canonical:
            raise ValueError(f"Invalid asset: {value}")
        return canonical

    @field_validator("outlook")
    @classmethod
    def validate_outlook(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_OUTLOOKS:
            raise ValueError(f"Invalid outlook: {value}")
        return normalized

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        cleaned = value.strip()
        lowered = cleaned.lower()
        for term in FORBIDDEN_REASON_TERMS:
            if term in lowered:
                raise ValueError(f"reason must not contain '{term}'")
        return cleaned


class EventAnalysisResult(BaseModel):
    category: str
    summary: str
    sentiment: str
    importance_score: float = Field(ge=0, le=100)
    key_points: list[str] = Field(min_length=1, max_length=8)
    impact_on_india: str
    impact_type: str
    affected_sectors: list[str] = Field(default_factory=list, max_length=10)
    risk_level: str
    confidence_score: float = Field(ge=0, le=100)
    market_impacts: list[MarketImpactItem] = Field(default_factory=list, max_length=12)

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        return normalize_category(value)

    @field_validator("sentiment")
    @classmethod
    def validate_sentiment(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_SENTIMENTS:
            raise ValueError(f"Invalid sentiment: {value}")
        return normalized

    @field_validator("impact_type")
    @classmethod
    def validate_impact_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_IMPACT_TYPES:
            raise ValueError(f"Invalid impact_type: {value}")
        return normalized

    @field_validator("risk_level")
    @classmethod
    def validate_risk_level(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in ALLOWED_RISK_LEVELS:
            raise ValueError(f"Invalid risk_level: {value}")
        return normalized

    @field_validator("key_points")
    @classmethod
    def validate_key_points(cls, value: list[str]) -> list[str]:
        cleaned = [point.strip() for point in value if point and point.strip()]
        if not cleaned:
            raise ValueError("key_points cannot be empty")
        return cleaned[:8]

    @field_validator("affected_sectors")
    @classmethod
    def validate_sectors(cls, value: list[str]) -> list[str]:
        normalized: list[str] = []
        for sector in value:
            if not sector or not sector.strip():
                continue
            canonical = try_normalize_sector(sector)
            if canonical and canonical not in normalized:
                normalized.append(canonical)
        return normalized[:10]

    @field_validator("market_impacts", mode="before")
    @classmethod
    def filter_market_impacts(cls, value: list | None) -> list:
        if not value:
            return []

        filtered: list[dict] = []
        for item in value:
            if not isinstance(item, dict):
                continue
            asset = try_normalize_market_asset(str(item.get("asset") or ""))
            if not asset:
                continue
            filtered.append({**item, "asset": asset})
        return filtered

    @field_validator("market_impacts")
    @classmethod
    def validate_market_impacts(
        cls, value: list[MarketImpactItem]
    ) -> list[MarketImpactItem]:
        seen: set[str] = set()
        unique: list[MarketImpactItem] = []
        for item in value:
            if item.asset in seen:
                continue
            seen.add(item.asset)
            unique.append(item)
        return unique[:12]
