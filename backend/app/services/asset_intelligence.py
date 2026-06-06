"""Centralized asset intelligence map for chat retrieval."""

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class QueryType(str, Enum):
    ASSET = "asset"
    SECTOR = "sector"
    GENERAL = "general"


@dataclass
class AssetProfile:
    canonical: str
    asset_type: str
    query_patterns: list[re.Pattern[str]]
    search_terms: list[str]
    false_positive_patterns: list[re.Pattern[str]] = field(default_factory=list)


SECTOR_ASSETS = frozenset({"Banking", "IT", "Pharma", "Auto", "Energy", "FMCG", "Metals"})

SECTOR_QUERY_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bsectors?\b", re.IGNORECASE),
    re.compile(r"\bwhich sector", re.IGNORECASE),
    re.compile(r"\bsector(s)?\s+(benefit|gain|lose|hurt)", re.IGNORECASE),
    re.compile(r"\b(benefit|hurt|impact)\s+.*\bsector", re.IGNORECASE),
]

ASSET_INTELLIGENCE: dict[str, AssetProfile] = {
    "Gold": AssetProfile(
        canonical="Gold",
        asset_type="commodity",
        query_patterns=[re.compile(r"\bgold\b", re.IGNORECASE)],
        search_terms=[
            "gold",
            "bullion",
            "precious metal",
            "precious metals",
            "inflation hedge",
            "commodity",
        ],
        false_positive_patterns=[
            re.compile(r"\bgolden\b", re.IGNORECASE),
            re.compile(r"\bgold medal\b", re.IGNORECASE),
            re.compile(r"\bhelmet\b", re.IGNORECASE),
            re.compile(r"\barchaeolog", re.IGNORECASE),
            re.compile(r"\bartifact\b", re.IGNORECASE),
            re.compile(r"\bmuseum\b", re.IGNORECASE),
        ],
    ),
    "Silver": AssetProfile(
        canonical="Silver",
        asset_type="commodity",
        query_patterns=[re.compile(r"\bsilver\b", re.IGNORECASE)],
        search_terms=["silver", "precious metal", "industrial metal", "bullion", "commodity"],
        false_positive_patterns=[re.compile(r"\bsilverware\b", re.IGNORECASE)],
    ),
    "Crude Oil": AssetProfile(
        canonical="Crude Oil",
        asset_type="commodity",
        query_patterns=[
            re.compile(r"\b(crude\s*oil|crude)\b", re.IGNORECASE),
            re.compile(r"\boil\b", re.IGNORECASE),
        ],
        search_terms=["crude oil", "crude", "oil", "petroleum", "energy", "opec", "barrel"],
        false_positive_patterns=[re.compile(r"\boil painting\b", re.IGNORECASE)],
    ),
    "Natural Gas": AssetProfile(
        canonical="Natural Gas",
        asset_type="commodity",
        query_patterns=[
            re.compile(r"\bnatural\s*gas\b", re.IGNORECASE),
            re.compile(r"\blng\b", re.IGNORECASE),
        ],
        search_terms=["natural gas", "gas", "lng", "energy"],
        false_positive_patterns=[],
    ),
    "Nifty": AssetProfile(
        canonical="Nifty",
        asset_type="market",
        query_patterns=[re.compile(r"\bnifty\b", re.IGNORECASE)],
        search_terms=["nifty", "indian market", "equity market", "index", "nifty 50"],
        false_positive_patterns=[],
    ),
    "Sensex": AssetProfile(
        canonical="Sensex",
        asset_type="market",
        query_patterns=[re.compile(r"\bsensex\b", re.IGNORECASE)],
        search_terms=[
            "sensex",
            "indian market",
            "stock market",
            "benchmark index",
            "equity market",
        ],
        false_positive_patterns=[],
    ),
    "USD/INR": AssetProfile(
        canonical="USD/INR",
        asset_type="market",
        query_patterns=[
            re.compile(r"\b(usd|inr|rupee|forex|currency)\b", re.IGNORECASE),
        ],
        search_terms=["usd/inr", "usd", "inr", "rupee", "forex", "currency", "exchange rate"],
        false_positive_patterns=[],
    ),
    "Banking": AssetProfile(
        canonical="Banking",
        asset_type="sector",
        query_patterns=[re.compile(r"\bbanking\b", re.IGNORECASE), re.compile(r"\bbanks?\b", re.IGNORECASE)],
        search_terms=["banking", "banks", "credit", "lending", "financial sector", "npa"],
        false_positive_patterns=[],
    ),
    "IT": AssetProfile(
        canonical="IT",
        asset_type="sector",
        query_patterns=[re.compile(r"\bit\b", re.IGNORECASE), re.compile(r"\btech\b", re.IGNORECASE)],
        search_terms=["it", "technology", "software", "semiconductor", "tech sector"],
        false_positive_patterns=[],
    ),
    "Pharma": AssetProfile(
        canonical="Pharma",
        asset_type="sector",
        query_patterns=[re.compile(r"\bpharma\b", re.IGNORECASE)],
        search_terms=["pharma", "healthcare", "pharmaceutical", "drug makers", "drug"],
        false_positive_patterns=[],
    ),
    "Auto": AssetProfile(
        canonical="Auto",
        asset_type="sector",
        query_patterns=[re.compile(r"\bauto\b", re.IGNORECASE)],
        search_terms=["auto", "automobile", "automotive", "vehicle", "ev"],
        false_positive_patterns=[],
    ),
    "Energy": AssetProfile(
        canonical="Energy",
        asset_type="sector",
        query_patterns=[re.compile(r"\benergy\b", re.IGNORECASE)],
        search_terms=["energy", "power", "utilities", "oil", "gas", "electricity"],
        false_positive_patterns=[],
    ),
    "FMCG": AssetProfile(
        canonical="FMCG",
        asset_type="sector",
        query_patterns=[re.compile(r"\bfmcg\b", re.IGNORECASE)],
        search_terms=["fmcg", "consumer goods", "fast moving consumer"],
        false_positive_patterns=[],
    ),
    "Metals": AssetProfile(
        canonical="Metals",
        asset_type="sector",
        query_patterns=[re.compile(r"\bmetals\b", re.IGNORECASE)],
        search_terms=["metals", "steel", "aluminium", "copper", "commodity", "mining"],
        false_positive_patterns=[],
    ),
}


@dataclass
class QueryIntent:
    query_type: QueryType
    detected_assets: set[str] = field(default_factory=set)


def detect_query_intent(question: str) -> QueryIntent:
    detected: set[str] = set()
    for profile in ASSET_INTELLIGENCE.values():
        for pattern in profile.query_patterns:
            if pattern.search(question):
                detected.add(profile.canonical)
                break

    if detected:
        return QueryIntent(query_type=QueryType.ASSET, detected_assets=detected)

    if any(pattern.search(question) for pattern in SECTOR_QUERY_PATTERNS):
        return QueryIntent(query_type=QueryType.SECTOR, detected_assets=set())

    return QueryIntent(query_type=QueryType.GENERAL, detected_assets=set())


def expand_search_terms(
    intent: QueryIntent,
    base_keywords: set[str],
) -> set[str]:
    terms = set(base_keywords)

    for asset in intent.detected_assets:
        profile = ASSET_INTELLIGENCE.get(asset)
        if not profile:
            continue
        terms.add(asset.lower())
        for term in profile.search_terms:
            cleaned = term.strip().lower()
            if cleaned:
                terms.add(cleaned)

    if intent.query_type == QueryType.SECTOR:
        terms.update({"sector", "sectors", "benefit", "impact", "affected"})

    return terms


def get_profile(asset: str) -> AssetProfile | None:
    return ASSET_INTELLIGENCE.get(asset)


def profile_for_asset(asset: str) -> dict[str, Any]:
    profile = ASSET_INTELLIGENCE.get(asset)
    if not profile:
        return {}
    return {
        "canonical": profile.canonical,
        "asset_type": profile.asset_type,
        "search_terms": profile.search_terms,
    }
