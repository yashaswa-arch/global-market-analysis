import logging
import re
from dataclasses import dataclass, field
from typing import Any

from app.services.asset_intelligence import (
    ASSET_INTELLIGENCE,
    SECTOR_ASSETS,
    QueryIntent,
    QueryType,
    detect_query_intent,
    expand_search_terms,
    get_profile,
)

logger = logging.getLogger(__name__)

FIELD_WEIGHTS: dict[str, int] = {
    "title": 3,
    "category": 2,
    "summary": 2,
    "impact_on_india": 6,
    "affected_sectors": 5,
    "market_impacts": 6,
    "key_points": 2,
}

BOOST_MARKET_IMPACT_ASSET = 30
BOOST_SECTOR_ASSET = 18
BOOST_ASSET_TERM_FIELD = 4
GENERAL_IMPORTANCE_DIVISOR = 25
PENALTY_FALSE_POSITIVE = 50
PENALTY_WEAK_ASSET_RELEVANCE = 25
MIN_ASSET_FIELD_RELEVANCE = 8
DIVERSITY_BONUS_NEW_CATEGORY = 10
DIVERSITY_PENALTY_TITLE_OVERLAP = 18
DIVERSITY_PENALTY_SAME_CATEGORY = 8
TITLE_OVERLAP_THRESHOLD = 0.45
SECTOR_QUERY_PRIORITY_CATEGORIES: dict[str, int] = {
    "conflict": 28,
    "geopolitics": 24,
    "economy": 20,
    "trade": 18,
    "energy": 16,
    "finance": 14,
    "technology": 12,
}
SECTOR_QUERY_FILTERED_CATEGORIES = frozenset(
    {"hospitality", "environment", "entertainment", "lifestyle"}
)
SECTOR_QUERY_MIN_IMPORTANCE = 60

# General "what's important?" questions — rank by intelligence signals, not keywords alone.
GENERAL_IMPORTANCE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bmost important\b", re.IGNORECASE),
    re.compile(r"\bimportant events\b", re.IGNORECASE),
    re.compile(r"\btop events\b", re.IGNORECASE),
    re.compile(r"\bkey (events|developments)\b", re.IGNORECASE),
    re.compile(r"\bglobal events\b", re.IGNORECASE),
    re.compile(r"\bwhat(?:'s| is) happening\b", re.IGNORECASE),
    re.compile(r"\bright now\b", re.IGNORECASE),
    re.compile(r"\blatest (news|events|developments)\b", re.IGNORECASE),
    re.compile(r"\bmajor (events|developments)\b", re.IGNORECASE),
]

GENERAL_QUERY_GENERIC_TERMS = {
    "important",
    "events",
    "event",
    "news",
    "right",
    "now",
    "most",
    "what",
    "are",
    "the",
    "currently",
    "happening",
    "latest",
    "global",
    "major",
    "key",
    "developments",
    "top",
}

HUMAN_INTEREST_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\bsurviv(al|e|or|ed|ing)\b", re.IGNORECASE),
    re.compile(r"\beverest\b", re.IGNORECASE),
    re.compile(r"\bmountain(eer| climbing)?\b", re.IGNORECASE),
    re.compile(r"\brescue(d|s)?\b", re.IGNORECASE),
    re.compile(r"\bmissing (hiker|climber|person)\b", re.IGNORECASE),
    re.compile(r"\bcelebrity\b", re.IGNORECASE),
    re.compile(r"\bwedding\b", re.IGNORECASE),
    re.compile(r"\bentertainment\b", re.IGNORECASE),
    re.compile(r"\blifestyle\b", re.IGNORECASE),
    re.compile(r"\bsports?\b", re.IGNORECASE),
    re.compile(r"\bhuman interest\b", re.IGNORECASE),
    re.compile(r"\bfeel-good\b", re.IGNORECASE),
]

RISK_LEVEL_BOOST: dict[str, int] = {
    "critical": 20,
    "high": 14,
    "medium": 8,
    "low": 0,
}

IMPORTANCE_MODE_DIVISOR = 5
BOOST_IMPACT_ON_INDIA_PRESENT = 12
BOOST_MARKET_IMPACTS_PRESENT = 10
PENALTY_HUMAN_INTEREST = 45
MIN_IMPORTANCE_FOR_SELECTION = 40


@dataclass
class RetrievalScore:
    total: int = 0
    breakdown: dict[str, int] = field(default_factory=dict)
    direct_evidence: bool = False

    def add(self, key: str, points: int) -> None:
        if points == 0:
            return
        self.breakdown[key] = self.breakdown.get(key, 0) + points
        self.total += points


@dataclass
class RetrievalResult:
    intent: QueryIntent
    expanded_terms: set[str]
    ranked: list[tuple[RetrievalScore, dict[str, Any]]]
    selected: list[dict[str, Any]]
    direct_evidence: bool
    inference_mode: bool


def term_matches(text: str, term: str) -> bool:
    if not text or not term:
        return False
    cleaned = term.strip()
    if not cleaned:
        return False
    if " " in cleaned or "/" in cleaned:
        return cleaned.lower() in text.lower()
    pattern = re.compile(rf"\b{re.escape(cleaned)}\b", re.IGNORECASE)
    return bool(pattern.search(text))


def _field_text(row: dict[str, Any], field: str) -> str:
    event = row.get("events") or {}
    if field == "title":
        return str(event.get("title") or "")
    if field == "affected_sectors":
        sectors = row.get("affected_sectors") or []
        if isinstance(sectors, list):
            return " ".join(str(sector) for sector in sectors)
        return str(sectors)
    if field == "market_impacts":
        return market_impacts_text(row.get("market_impacts"))
    if field == "key_points":
        key_points = row.get("key_points") or []
        if isinstance(key_points, list):
            return " ".join(str(point) for point in key_points)
        return str(key_points)
    return str(row.get(field) or "")


def market_impacts_text(market_impacts: Any) -> str:
    if not isinstance(market_impacts, list):
        return str(market_impacts or "")
    parts: list[str] = []
    for impact in market_impacts:
        if not isinstance(impact, dict):
            continue
        parts.append(
            " ".join(
                [
                    str(impact.get("asset") or ""),
                    str(impact.get("outlook") or ""),
                    str(impact.get("confidence") or ""),
                    str(impact.get("reason") or ""),
                ]
            )
        )
    return " ".join(parts)


def market_impact_assets(row: dict[str, Any]) -> set[str]:
    assets: set[str] = set()
    impacts = row.get("market_impacts") or []
    if not isinstance(impacts, list):
        return assets
    for impact in impacts:
        if isinstance(impact, dict) and impact.get("asset"):
            assets.add(str(impact["asset"]))
    return assets


def affected_sectors(row: dict[str, Any]) -> set[str]:
    sectors = row.get("affected_sectors") or []
    if not isinstance(sectors, list):
        return set()
    return {str(sector) for sector in sectors if sector}


def row_has_direct_evidence(row: dict[str, Any], detected_assets: set[str]) -> bool:
    if not detected_assets:
        return False

    market_assets = market_impact_assets(row)
    if detected_assets & market_assets:
        return True

    sectors = affected_sectors(row)
    for asset in detected_assets:
        if asset in SECTOR_ASSETS and asset in sectors:
            return True
    return False


def is_false_positive(row: dict[str, Any], detected_assets: set[str]) -> bool:
    if not detected_assets:
        return False

    title = _field_text(row, "title")
    market_assets = market_impact_assets(row)

    for asset in detected_assets:
        profile = get_profile(asset)
        if not profile:
            continue
        if asset in market_assets:
            continue
        for pattern in profile.false_positive_patterns:
            if pattern.search(title):
                return True
    return False


def is_importance_query(question: str, intent: QueryIntent) -> bool:
    if intent.query_type != QueryType.GENERAL:
        return False
    return any(pattern.search(question) for pattern in GENERAL_IMPORTANCE_PATTERNS)


def is_human_interest(row: dict[str, Any]) -> bool:
    text = " ".join(
        [
            _field_text(row, "title"),
            _field_text(row, "summary"),
            _field_text(row, "key_points"),
        ]
    )
    return any(pattern.search(text) for pattern in HUMAN_INTEREST_PATTERNS)


def _effective_search_terms(search_terms: set[str], importance_mode: bool) -> set[str]:
    if not importance_mode:
        return search_terms
    filtered = search_terms - GENERAL_QUERY_GENERIC_TERMS
    return filtered or search_terms


def _importance_value(row: dict[str, Any]) -> int:
    importance = row.get("importance_score")
    if isinstance(importance, (int, float)):
        return int(importance)
    return 0


def _has_substantive_impact_on_india(row: dict[str, Any]) -> bool:
    text = _field_text(row, "impact_on_india").strip()
    return len(text) >= 40 and text.lower() not in {"none", "no direct impact", "n/a"}


def _has_market_impacts(row: dict[str, Any]) -> bool:
    impacts = row.get("market_impacts") or []
    return isinstance(impacts, list) and len(impacts) > 0


def score_row(
    row: dict[str, Any],
    search_terms: set[str],
    intent: QueryIntent,
    *,
    importance_mode: bool = False,
) -> RetrievalScore:
    result = RetrievalScore()
    detected_assets = intent.detected_assets

    if is_false_positive(row, detected_assets):
        result.add("penalty_false_positive", -PENALTY_FALSE_POSITIVE)

    if importance_mode and is_human_interest(row):
        result.add("penalty_human_interest", -PENALTY_HUMAN_INTEREST)

    terms = _effective_search_terms(search_terms, importance_mode)
    for field, weight in FIELD_WEIGHTS.items():
        text = _field_text(row, field)
        hits = sum(1 for term in terms if term_matches(text, term))
        if hits:
            result.add(f"term_{field}", hits * weight)

    if detected_assets:
        for field, weight in FIELD_WEIGHTS.items():
            text = _field_text(row, field)
            for asset in detected_assets:
                profile = get_profile(asset)
                if not profile:
                    continue
                asset_hits = sum(
                    1 for term in profile.search_terms if term_matches(text, term)
                )
                if asset_hits:
                    result.add(
                        f"asset_map_{field}_{asset}",
                        asset_hits * BOOST_ASSET_TERM_FIELD,
                    )

    sectors = affected_sectors(row)
    market_assets = market_impact_assets(row)
    for asset in detected_assets:
        if asset in market_assets:
            result.add(f"market_impact_{asset}", BOOST_MARKET_IMPACT_ASSET)
            result.direct_evidence = True
        if asset in SECTOR_ASSETS and asset in sectors:
            result.add(f"sector_match_{asset}", BOOST_SECTOR_ASSET)
            result.direct_evidence = True

    importance = _importance_value(row)
    if importance > 0:
        divisor = IMPORTANCE_MODE_DIVISOR if importance_mode else GENERAL_IMPORTANCE_DIVISOR
        result.add("importance_score", importance // divisor)

    if intent.query_type == QueryType.SECTOR:
        sector_priority = _sector_priority_bonus(row)
        if sector_priority:
            result.add("sector_priority", sector_priority)

    if importance_mode:
        risk = str(row.get("risk_level") or "").lower()
        risk_boost = RISK_LEVEL_BOOST.get(risk, 0)
        if risk_boost:
            result.add("risk_level", risk_boost)

        if _has_substantive_impact_on_india(row):
            result.add("impact_on_india_present", BOOST_IMPACT_ON_INDIA_PRESENT)

        if _has_market_impacts(row):
            result.add("market_impacts_present", BOOST_MARKET_IMPACTS_PRESENT)

    if detected_assets and result.total < 0:
        result.total = 0
        result.breakdown["clamped_zero"] = 0

    if intent.query_type in {QueryType.ASSET, QueryType.SECTOR} and detected_assets:
        asset_signal = sum(
            result.breakdown.get(f"market_impact_{asset}", 0)
            for asset in detected_assets
        )
        asset_field_hits = sum(
            value
            for key, value in result.breakdown.items()
            if key.startswith("asset_map_impact_on_india")
            or key.startswith("asset_map_market_impacts")
            or key.startswith("asset_map_affected_sectors")
            or key.startswith("sector_match_")
        )
        if not result.direct_evidence and asset_signal + asset_field_hits < MIN_ASSET_FIELD_RELEVANCE:
            result.add("penalty_weak_asset_relevance", -PENALTY_WEAK_ASSET_RELEVANCE)

    return result


def _title_tokens(row: dict[str, Any]) -> set[str]:
    title = _field_text(row, "title").lower()
    return {token for token in re.findall(r"[a-z0-9]+", title) if len(token) > 2}


def _title_overlap(row: dict[str, Any], other: dict[str, Any]) -> float:
    a = _title_tokens(row)
    b = _title_tokens(other)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _row_category(row: dict[str, Any]) -> str:
    return str(row.get("category") or "unknown").lower()


def _sector_priority_bonus(row: dict[str, Any]) -> int:
    return SECTOR_QUERY_PRIORITY_CATEGORIES.get(_row_category(row), 0)


def _asset_field_relevance(row: dict[str, Any], intent: QueryIntent) -> int:
    if not intent.detected_assets:
        return 0
    score = 0
    for field in ("impact_on_india", "market_impacts", "affected_sectors", "summary"):
        text = _field_text(row, field)
        for asset in intent.detected_assets:
            profile = get_profile(asset)
            if not profile:
                continue
            hits = sum(1 for term in profile.search_terms if term_matches(text, term))
            score += hits * 2
    if row_has_direct_evidence(row, intent.detected_assets):
        score += 20
    return score


def _diversity_adjustment(
    row: dict[str, Any],
    selected: list[dict[str, Any]],
) -> int:
    if not selected:
        return 0

    adjustment = 0
    category = _row_category(row)
    used_categories = {_row_category(item) for item in selected}

    if category not in used_categories:
        adjustment += DIVERSITY_BONUS_NEW_CATEGORY
    elif sum(1 for item in selected if _row_category(item) == category) >= 2:
        adjustment -= DIVERSITY_PENALTY_SAME_CATEGORY

    for existing in selected:
        overlap = _title_overlap(row, existing)
        if overlap >= TITLE_OVERLAP_THRESHOLD:
            adjustment -= DIVERSITY_PENALTY_TITLE_OVERLAP

    return adjustment


def _passes_asset_filter(
    scored: RetrievalScore,
    row: dict[str, Any],
    intent: QueryIntent,
) -> bool:
    if is_false_positive(row, intent.detected_assets) and not (
        intent.detected_assets & market_impact_assets(row)
    ):
        return False

    if scored.total <= 0:
        return False

    category = _row_category(row)
    if (
        intent.query_type in {QueryType.ASSET, QueryType.SECTOR}
        and category in SECTOR_QUERY_FILTERED_CATEGORIES
        and _importance_value(row) < SECTOR_QUERY_MIN_IMPORTANCE
        and not row_has_direct_evidence(row, intent.detected_assets)
    ):
        return False

    if intent.query_type not in {QueryType.ASSET, QueryType.SECTOR}:
        return True

    if not intent.detected_assets:
        return True

    if scored.direct_evidence:
        return True

    if _asset_field_relevance(row, intent) >= MIN_ASSET_FIELD_RELEVANCE:
        return True

    return False


def _passes_importance_filter(
    scored: RetrievalScore,
    row: dict[str, Any],
    importance_mode: bool,
) -> bool:
    if not importance_mode:
        return True

    importance = _importance_value(row)
    if is_human_interest(row) and importance < 55:
        return False

    if importance >= MIN_IMPORTANCE_FOR_SELECTION:
        return True

    if scored.total >= 25 and not is_human_interest(row):
        return True

    return False


def _ranking_sort_key(
    scored: RetrievalScore,
    row: dict[str, Any],
    importance_mode: bool,
    intent: QueryIntent,
) -> tuple[int, int, int]:
    importance = _importance_value(row)
    sector_priority = _sector_priority_bonus(row) if intent.query_type == QueryType.SECTOR else 0
    if importance_mode:
        return (sector_priority, scored.total + importance, importance)
    return (sector_priority, scored.total, importance)


def retrieve_events(
    rows: list[dict[str, Any]],
    question: str,
    base_keywords: set[str],
    *,
    max_events: int,
) -> RetrievalResult:
    intent = detect_query_intent(question)
    expanded_terms = expand_search_terms(intent, base_keywords)
    importance_mode = is_importance_query(question, intent)

    ranked: list[tuple[RetrievalScore, dict[str, Any]]] = []
    for row in rows:
        scored = score_row(
            row, expanded_terms, intent, importance_mode=importance_mode
        )
        ranked.append((scored, row))
    ranked.sort(
        key=lambda item: _ranking_sort_key(item[0], item[1], importance_mode, intent),
        reverse=True,
    )

    pool = [
        (scored, row)
        for scored, row in ranked
        if _passes_asset_filter(scored, row, intent)
        and _passes_importance_filter(scored, row, importance_mode)
    ]

    selected: list[dict[str, Any]] = []
    remaining = list(pool)

    while remaining and len(selected) < max_events:
        best_index = 0
        best_adjusted = -9999
        for index, (scored, row) in enumerate(remaining):
            adjusted = scored.total + _diversity_adjustment(row, selected)
            if adjusted > best_adjusted:
                best_adjusted = adjusted
                best_index = index
        _, chosen = remaining.pop(best_index)
        selected.append(chosen)

    if not selected:
        if intent.query_type not in {QueryType.ASSET, QueryType.SECTOR}:
            selected = [row for _, row in ranked[:max_events]]

    direct_evidence = any(
        row_has_direct_evidence(row, intent.detected_assets) for row in selected
    )
    inference_mode = (
        intent.query_type in {QueryType.ASSET, QueryType.SECTOR}
        and not direct_evidence
    )

    log_retrieval_debug(
        question=question,
        intent=intent,
        expanded_terms=expanded_terms,
        ranked=ranked,
        selected=selected,
        direct_evidence=direct_evidence,
        inference_mode=inference_mode,
        importance_mode=importance_mode,
    )

    return RetrievalResult(
        intent=intent,
        expanded_terms=expanded_terms,
        ranked=ranked,
        selected=selected,
        direct_evidence=direct_evidence,
        inference_mode=inference_mode,
    )


def log_retrieval_debug(
    *,
    question: str,
    intent: QueryIntent,
    expanded_terms: set[str],
    ranked: list[tuple[RetrievalScore, dict[str, Any]]],
    selected: list[dict[str, Any]],
    direct_evidence: bool,
    inference_mode: bool,
    importance_mode: bool = False,
) -> None:
    candidates = []
    for scored, row in ranked[:10]:
        event = row.get("events") or {}
        candidates.append(
            {
                "title": (event.get("title") or "")[:80],
                "score": scored.total,
                "importance_score": _importance_value(row),
                "breakdown": scored.breakdown,
                "direct_evidence": scored.direct_evidence,
                "human_interest": is_human_interest(row),
                "market_assets": sorted(market_impact_assets(row)),
                "sectors": sorted(affected_sectors(row)),
                "false_positive": is_false_positive(row, intent.detected_assets),
            }
        )

    selected_titles = [
        (row.get("events") or {}).get("title", "")[:80] for row in selected
    ]
    selected_categories = [_row_category(row) for row in selected]

    logger.info(
        "Chat retrieval debug",
        extra={
            "question": question[:120],
            "query_type": intent.query_type.value,
            "detected_assets": sorted(intent.detected_assets),
            "expanded_terms": sorted(expanded_terms),
            "direct_evidence": direct_evidence,
            "inference_mode": inference_mode,
            "importance_mode": importance_mode,
            "candidate_scores": candidates,
            "selected_events": selected_titles,
            "selected_categories": selected_categories,
            "diversity_selection": True,
        },
    )
