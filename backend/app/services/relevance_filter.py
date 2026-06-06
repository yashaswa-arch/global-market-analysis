import re

# Obvious non-intelligence content — skip before calling Groq.
IGNORE_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bcelebrity\b",
        r"\bcelebrities\b",
        r"\bentertainment\b",
        r"\bwedding\b",
        r"\bmarriage ceremony\b",
        r"\bgossip\b",
        r"\btabloid\b",
        r"\blifestyle\b",
        r"\bfashion week\b",
        r"\bred carpet\b",
        r"\bbollywood party\b",
        r"\bhollywood romance\b",
        r"\bsports gossip\b",
        r"\btransfer rumor\b",
        r"\bpage 3\b",
    ]
]

# Intelligence topics — at least one should appear for borderline items.
RELEVANT_PATTERNS: list[re.Pattern[str]] = [
    re.compile(p, re.IGNORECASE)
    for p in [
        r"\bgeopolitic",
        r"\bdiplomacy\b",
        r"\binternational relation",
        r"\bforeign policy\b",
        r"\bconflict\b",
        r"\bwar\b",
        r"\bsanction",
        r"\beconom",
        r"\btrade\b",
        r"\btariff",
        r"\bmarket\b",
        r"\benergy\b",
        r"\boil\b",
        r"\bgas\b",
        r"\btechnology\b",
        r"\bsemiconductor",
        r"\bdefen",
        r"\bmilitary\b",
        r"\bsupply chain",
        r"\bshipping\b",
        r"\bnuclear\b",
        r"\belection\b",
        r"\bgovernment\b",
        r"\bcentral bank\b",
        r"\binflation\b",
        r"\bclimate\b",
        r"\bcyber\b",
    ]
]


def is_relevant_event(title: str, description: str | None = None) -> tuple[bool, str]:
    """
    Pre-Groq relevance filter.

    Returns (is_relevant, reason).
    """
    text = f"{title} {description or ''}".strip()
    if not text:
        return False, "empty_content"

    for pattern in IGNORE_PATTERNS:
        if pattern.search(text):
            return False, f"ignored_keyword:{pattern.pattern}"

    if any(pattern.search(text) for pattern in RELEVANT_PATTERNS):
        return True, "relevant_keyword_match"

    # Global news from our feeds is often relevant even without keyword hits.
    return True, "default_pass"
