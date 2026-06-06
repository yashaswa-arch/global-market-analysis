"""RSS feed reliability checker for configured GEIP sources."""
import feedparser
import httpx

from app.services.news_service import RSS_FEEDS


def check_feed(name: str, url: str) -> bool:
    try:
        response = httpx.get(
            url,
            timeout=30,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; GEIP-RSS/1.0)"},
        )
        response.raise_for_status()
        text = response.text
        is_xml = "<?xml" in text[:2000].lower() or "<rss" in text[:2000].lower() or "<feed" in text[:2000].lower()
        parsed = feedparser.parse(text)
        ok = is_xml and len(parsed.entries) > 0
        label = "OK" if ok else "FAIL"
        print(f"{label} | {name} | status={response.status_code} entries={len(parsed.entries)} xml={is_xml}")
        if parsed.entries:
            print(f"   sample: {parsed.entries[0].title[:70]}")
        return ok
    except Exception as exc:
        print(f"FAIL | {name} | {exc}")
        return False


if __name__ == "__main__":
    results = [check_feed(name, url) for name, url in RSS_FEEDS.items()]
    print(f"\n{sum(results)}/{len(results)} feeds OK")
