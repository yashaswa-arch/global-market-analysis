"""One-off audit: capture Groq validation failures on unanalyzed events."""

import asyncio
import re
import sys
from collections import Counter
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
AI_SERVICES = BACKEND_DIR.parent / "ai-services"
sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(AI_SERVICES))

from pydantic import ValidationError  # noqa: E402

from analyzer.engine import _extract_json  # noqa: E402
from analyzer.prompts import SYSTEM_PROMPT, build_user_prompt  # noqa: E402
from analyzer.schemas import EventAnalysisResult  # noqa: E402
from app.database.supabase_client import get_supabase  # noqa: E402
from groq_client import groq_complete  # noqa: E402


async def audit_one(event: dict) -> dict:
    raw = await groq_complete(
        SYSTEM_PROMPT,
        build_user_prompt(
            title=event.get("title") or "",
            description=event.get("description"),
            source=event.get("source"),
            url=event.get("url"),
        ),
        json_mode=True,
    )
    payload = _extract_json(raw)
    try:
        result = EventAnalysisResult.model_validate(payload)
        return {"ok": True, "category": result.category}
    except ValidationError as exc:
        issues = []
        for err in exc.errors():
            loc = ".".join(str(x) for x in err.get("loc", ()))
            issues.append(
                {
                    "field": loc,
                    "msg": err.get("msg", ""),
                    "input": err.get("input"),
                }
            )
        return {
            "ok": False,
            "issues": issues,
            "raw_category": payload.get("category"),
            "raw_sectors": payload.get("affected_sectors"),
            "raw_assets": [
                x.get("asset")
                for x in (payload.get("market_impacts") or [])
                if isinstance(x, dict)
            ],
        }


async def main() -> None:
    db = get_supabase()
    resp = (
        db.table("events")
        .select("id, title, description, source, url")
        .eq("is_analyzed", False)
        .order("created_at")
        .limit(70)
        .execute()
    )
    events = resp.data or []

    failures: list[dict] = []
    successes = 0

    for event in events:
        if len(failures) >= 50:
            break
        try:
            result = await audit_one(event)
        except Exception as exc:
            failures.append(
                {
                    "event_id": event["id"],
                    "title": (event.get("title") or "")[:60],
                    "issues": [{"field": "runtime", "msg": str(exc), "input": None}],
                }
            )
            continue

        if result.get("ok"):
            successes += 1
        else:
            failures.append(
                {
                    "event_id": event["id"],
                    "title": (event.get("title") or "")[:60],
                    **result,
                }
            )

    field_counts: Counter[str] = Counter()
    value_counts: Counter[str] = Counter()
    category_rejects: Counter[str] = Counter()
    sector_rejects: Counter[str] = Counter()
    asset_rejects: Counter[str] = Counter()

    for failure in failures:
        for issue in failure.get("issues", []):
            field = issue["field"]
            field_counts[field] += 1
            msg = issue["msg"]
            inp = issue["input"]

            if field == "category":
                category_rejects[str(inp)] += 1
            elif field == "affected_sectors":
                if isinstance(inp, list):
                    for value in inp:
                        sector_rejects[str(value)] += 1
                else:
                    sector_rejects[str(inp)] += 1
            elif field.endswith(".asset"):
                asset_rejects[str(inp)] += 1

            match = re.search(r"Invalid \w+: (.+)$", msg)
            if match:
                value_counts[f"{field}::{match.group(1)}"] += 1

    print("AUDIT_SUMMARY")
    print("events_tried", len(failures) + successes)
    print("successes", successes)
    print("failures", len(failures))
    print("FIELD_COUNTS", dict(field_counts.most_common(15)))
    print("CATEGORY_REJECTS", dict(category_rejects.most_common(20)))
    print("SECTOR_REJECTS", dict(sector_rejects.most_common(20)))
    print("ASSET_REJECTS", dict(asset_rejects.most_common(20)))
    print("TOP_VALUE_ERRORS", dict(value_counts.most_common(25)))


if __name__ == "__main__":
    asyncio.run(main())
