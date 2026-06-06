import logging
import re
from datetime import UTC, datetime
from typing import Any

import feedparser
import httpx

from app.config.settings import get_settings
from app.core.exceptions import SupabaseQueryError
from app.database.supabase_client import EVENTS_TABLE, get_supabase
from app.models.schemas import NewsFetchStats, NormalizedEvent

logger = logging.getLogger(__name__)

RSS_FEEDS: dict[str, str] = {
    "BBC World News": "http://feeds.bbci.co.uk/news/world/rss.xml",
    # Reuters retired feeds.reuters.com RSS; Google News syndication is reliable.
    "Reuters World News": "https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en",
    # AP direct RSS and RSSHub are blocked; Google News AP syndication works.
    "AP News": "https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en",
    "CNBC News": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
}

GNEWS_HEADLINES_URL = "https://gnews.io/api/v4/top-headlines"
GNEWS_SEARCH_URL = "https://gnews.io/api/v4/search"

# Extra search queries for unique articles beyond world headlines.
GNEWS_SEARCH_QUERIES: tuple[str, ...] = (
    "global economy markets",
    "geopolitics conflict trade",
)


class NewsService:
    """Collects news from RSS + GNews, normalizes, deduplicates, stores in events."""

    def __init__(self) -> None:
        self.db = get_supabase()

    @property
    def settings(self):
        return get_settings()

    async def collect_all(self) -> NewsFetchStats:
        """Fetch from all sources, normalize, dedupe, and insert new events."""
        stats = NewsFetchStats()
        normalized: list[NormalizedEvent] = []

        rss_items, rss_errors = self._fetch_rss()
        stats.errors.extend(rss_errors)
        normalized.extend(rss_items)
        stats.sources["rss"] = len(rss_items)

        if self._gnews_configured():
            gnews_items, gnews_errors = await self._fetch_gnews()
            stats.errors.extend(gnews_errors)
            normalized.extend(gnews_items)
            stats.sources["gnews"] = len(gnews_items)
        else:
            logger.warning("GNEWS_API_KEY not set — skipping GNews fetch")
            stats.sources["gnews"] = 0

        stats.fetched = len(normalized)
        inserted, skipped, enriched = self._store_events(normalized)
        stats.inserted = inserted
        stats.skipped_duplicates = skipped
        stats.enriched_descriptions = enriched
        stats.sources["gnews_enriched"] = enriched

        logger.info(
            "News collection complete",
            extra={
                "fetched": stats.fetched,
                "inserted": stats.inserted,
                "skipped": stats.skipped_duplicates,
                "enriched": stats.enriched_descriptions,
                "errors": len(stats.errors),
            },
        )
        return stats

    def _gnews_configured(self) -> bool:
        key = self.settings.gnews_api_key.strip()
        if not key or key == "your-gnews-api-key":
            if key == "your-gnews-api-key":
                logger.warning("GNEWS_API_KEY is still the placeholder — update .env and restart")
            else:
                logger.warning("GNEWS_API_KEY not set — skipping GNews fetch")
            return False
        return True

    def _fetch_rss(self) -> tuple[list[NormalizedEvent], list[str]]:
        events: list[NormalizedEvent] = []
        errors: list[str] = []
        max_per_feed = self.settings.rss_max_articles_per_feed

        for source_name, feed_url in RSS_FEEDS.items():
            try:
                with httpx.Client(
                    timeout=30.0,
                    follow_redirects=True,
                    headers={"User-Agent": "Mozilla/5.0 (compatible; GEIP-RSS/1.0)"},
                ) as client:
                    response = client.get(feed_url)
                    response.raise_for_status()

                if not self._is_valid_rss_xml(response.text):
                    msg = f"RSS invalid XML: {source_name} ({feed_url})"
                    logger.error(msg)
                    errors.append(msg)
                    continue

                feed = feedparser.parse(response.text)
                if not feed.entries:
                    msg = f"RSS empty feed: {source_name} ({feed_url})"
                    logger.error(msg)
                    errors.append(msg)
                    continue

                for entry in feed.entries[:max_per_feed]:
                    event = self._normalize_rss_entry(source_name, entry)
                    if event:
                        events.append(event)

                logger.info("RSS fetched", extra={"source": source_name, "count": len(feed.entries[:max_per_feed])})
            except Exception as exc:
                msg = f"RSS error ({source_name}): {exc}"
                logger.exception(msg)
                errors.append(msg)

        return events, errors

    async def _fetch_gnews(self) -> tuple[list[NormalizedEvent], list[str]]:
        events: list[NormalizedEvent] = []
        errors: list[str] = []
        seen_urls: set[str] = set()
        api_key = self.settings.gnews_api_key
        headline_max = self.settings.gnews_max_articles
        search_max = max(3, self.settings.gnews_max_articles // len(GNEWS_SEARCH_QUERIES))

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                headline_articles, headline_error = await self._gnews_get_safe(
                    client,
                    GNEWS_HEADLINES_URL,
                    {
                        "category": "world",
                        "lang": "en",
                        "max": headline_max,
                        "apikey": api_key,
                    },
                )
                if headline_error:
                    errors.append(headline_error)
                for article in headline_articles:
                    self._append_gnews_article(article, events, seen_urls)

                for query in GNEWS_SEARCH_QUERIES:
                    search_articles, search_error = await self._gnews_get_safe(
                        client,
                        GNEWS_SEARCH_URL,
                        {
                            "q": query,
                            "lang": "en",
                            "max": search_max,
                            "apikey": api_key,
                        },
                    )
                    if search_error:
                        errors.append(search_error)
                        if "429" in search_error:
                            logger.warning("GNews rate limit hit — skipping remaining search queries")
                            break
                    for article in search_articles:
                        self._append_gnews_article(article, events, seen_urls)

            logger.info(
                "GNews fetched",
                extra={
                    "count": len(events),
                    "headline_max": headline_max,
                    "search_max": search_max,
                },
            )
        except Exception as exc:
            msg = f"GNews error: {exc}"
            logger.exception(msg)
            errors.append(msg)

        return events, errors

    async def _gnews_get_safe(
        self,
        client: httpx.AsyncClient,
        url: str,
        params: dict[str, Any],
    ) -> tuple[list[dict[str, Any]], str | None]:
        try:
            response = await client.get(url, params=params)
            response.raise_for_status()
            data = response.json()
            return data.get("articles") or [], None
        except httpx.HTTPError as exc:
            label = params.get("q") or params.get("category") or url
            msg = f"GNews unavailable ({label}): {exc}"
            logger.error(msg)
            return [], msg

    def _append_gnews_article(
        self,
        article: dict[str, Any],
        events: list[NormalizedEvent],
        seen_urls: set[str],
    ) -> None:
        event = self._normalize_gnews_article(article)
        if not event:
            return
        norm_url = self._normalize_url(event.url)
        if norm_url in seen_urls:
            return
        seen_urls.add(norm_url)
        events.append(event)

    def _normalize_rss_entry(self, source_name: str, entry: Any) -> NormalizedEvent | None:
        url = self._normalize_url(entry.get("link") or "")
        title = (entry.get("title") or "").strip()
        if not url or not title:
            return None

        description = entry.get("summary") or entry.get("description")
        published_at = None
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            published_at = datetime(*entry.published_parsed[:6], tzinfo=UTC)

        return NormalizedEvent(
            title=title,
            description=self._clean_text(description),
            source=source_name,
            url=url,
            published_at=published_at,
        )

    def _normalize_gnews_article(self, article: dict[str, Any]) -> NormalizedEvent | None:
        url = self._normalize_url(article.get("url") or "")
        title = (article.get("title") or "").strip()
        if not url or not title:
            return None

        published_at = None
        if article.get("publishedAt"):
            try:
                published_at = datetime.fromisoformat(
                    article["publishedAt"].replace("Z", "+00:00")
                )
            except ValueError:
                pass

        source_name = "GNews"
        if isinstance(article.get("source"), dict):
            source_name = f"GNews — {article['source'].get('name', 'GNews')}"

        return NormalizedEvent(
            title=title,
            description=self._extract_gnews_description(article),
            source=source_name,
            url=url,
            published_at=published_at,
        )

    def _extract_gnews_description(self, article: dict[str, Any]) -> str | None:
        """Merge GNews description + content for richer event context."""
        description = self._clean_text(article.get("description"))
        content = self._clean_text(article.get("content"))
        return self._merge_descriptions(description, content)

    def _store_events(self, events: list[NormalizedEvent]) -> tuple[int, int, int]:
        if not events:
            return 0, 0, 0

        existing_urls, existing_titles, existing_by_url = self._load_existing_keys()
        inserted = skipped = enriched = 0
        batch_urls: set[str] = set()
        batch_titles: set[str] = set()

        for event in events:
            norm_url = self._normalize_url(event.url)
            norm_title = self._normalize_title(event.title)

            if norm_url in existing_urls or norm_url in batch_urls:
                if self._maybe_enrich_description(existing_by_url.get(norm_url), event):
                    enriched += 1
                skipped += 1
                continue

            if norm_title in existing_titles or norm_title in batch_titles:
                skipped += 1
                continue

            try:
                row = {
                    "title": event.title,
                    "description": event.description,
                    "source": event.source,
                    "url": norm_url,
                    "published_at": event.published_at.isoformat() if event.published_at else None,
                    "is_analyzed": False,
                }
                self.db.table(EVENTS_TABLE).insert(row).execute()
                existing_urls.add(norm_url)
                existing_titles.add(norm_title)
                batch_urls.add(norm_url)
                batch_titles.add(norm_title)
                inserted += 1
            except Exception as exc:
                if self._is_duplicate_url_error(exc):
                    logger.info("Duplicate URL skipped (database constraint)", extra={"url": norm_url})
                    existing_urls.add(norm_url)
                    batch_urls.add(norm_url)
                    skipped += 1
                    continue
                logger.error("Database insert failed", extra={"url": norm_url, "error": str(exc)})
                raise SupabaseQueryError(
                    f"Failed to insert event: {exc}", table=EVENTS_TABLE
                ) from exc

        return inserted, skipped, enriched

    def _maybe_enrich_description(
        self,
        existing: dict[str, Any] | None,
        event: NormalizedEvent,
    ) -> bool:
        """Update stored description when GNews (or another source) adds richer text."""
        if not existing or not event.description:
            return False

        old_desc = existing.get("description") or ""
        merged = self._merge_descriptions(old_desc, event.description)
        if not merged or len(merged) <= len(old_desc) + 30:
            return False

        update: dict[str, Any] = {"description": merged}
        if existing.get("is_analyzed") and len(merged) > len(old_desc) * 1.25:
            update["is_analyzed"] = False

        try:
            self.db.table(EVENTS_TABLE).update(update).eq("id", existing["id"]).execute()
            existing["description"] = merged
            if "is_analyzed" in update:
                existing["is_analyzed"] = False
            logger.info(
                "Event description enriched",
                extra={
                    "event_id": existing["id"],
                    "old_len": len(old_desc),
                    "new_len": len(merged),
                    "source": event.source,
                },
            )
            return True
        except Exception as exc:
            logger.warning(
                "Failed to enrich event description",
                extra={"event_id": existing.get("id"), "error": str(exc)},
            )
            return False

    def _load_existing_keys(
        self,
    ) -> tuple[set[str], set[str], dict[str, dict[str, Any]]]:
        urls: set[str] = set()
        titles: set[str] = set()
        by_url: dict[str, dict[str, Any]] = {}
        offset = 0
        page_size = 1000

        try:
            while True:
                response = (
                    self.db.table(EVENTS_TABLE)
                    .select("id, url, title, description, is_analyzed")
                    .range(offset, offset + page_size - 1)
                    .execute()
                )
                rows = response.data or []
                if not rows:
                    break

                for row in rows:
                    if row.get("url"):
                        norm_url = self._normalize_url(row["url"])
                        urls.add(norm_url)
                        by_url[norm_url] = {
                            "id": row["id"],
                            "description": row.get("description") or "",
                            "is_analyzed": bool(row.get("is_analyzed")),
                        }
                    if row.get("title"):
                        titles.add(self._normalize_title(row["title"]))

                if len(rows) < page_size:
                    break
                offset += page_size
        except Exception as exc:
            logger.exception("Failed to load existing events for deduplication")
            raise SupabaseQueryError(
                f"Failed to load existing events: {exc}", table=EVENTS_TABLE
            ) from exc

        return urls, titles, by_url

    def list_events(self, *, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        try:
            response = (
                self.db.table(EVENTS_TABLE)
                .select("*", count="exact")
                .order("published_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        except Exception as exc:
            logger.exception("Failed to list events")
            raise SupabaseQueryError(f"Failed to list events: {exc}", table=EVENTS_TABLE) from exc

        return {
            "events": response.data,
            "total": response.count if response.count is not None else len(response.data),
            "limit": limit,
            "offset": offset,
        }

    def list_unanalyzed(self, *, limit: int = 20, offset: int = 0) -> dict[str, Any]:
        try:
            response = (
                self.db.table(EVENTS_TABLE)
                .select("*", count="exact")
                .eq("is_analyzed", False)
                .order("created_at", desc=True)
                .range(offset, offset + limit - 1)
                .execute()
            )
        except Exception as exc:
            logger.exception("Failed to list unanalyzed events")
            raise SupabaseQueryError(
                f"Failed to list unanalyzed events: {exc}", table=EVENTS_TABLE
            ) from exc

        return {
            "events": response.data,
            "total": response.count if response.count is not None else len(response.data),
            "limit": limit,
            "offset": offset,
        }

    @staticmethod
    def _is_valid_rss_xml(content: str) -> bool:
        snippet = content[:2000].lower()
        return "<?xml" in snippet or "<rss" in snippet or "<feed" in snippet

    @staticmethod
    def _normalize_url(url: str) -> str:
        """Canonicalize URL for consistent deduplication."""
        cleaned = url.strip()
        if not cleaned:
            return ""
        cleaned = cleaned.rstrip("/")
        return cleaned

    @staticmethod
    def _is_duplicate_url_error(exc: Exception) -> bool:
        message = str(exc).lower()
        return (
            "duplicate key" in message
            or "unique constraint" in message
            or "events_url_unique" in message
            or "23505" in message
        )

    @staticmethod
    def _normalize_title(title: str) -> str:
        cleaned = re.sub(r"\s+", " ", title.lower().strip())
        cleaned = re.sub(r"[^\w\s]", "", cleaned)
        return cleaned

    @staticmethod
    def _clean_text(text: str | None) -> str | None:
        if not text:
            return None
        cleaned = re.sub(r"<[^>]+>", "", text)
        cleaned = re.sub(r"\[\+\d+\s*chars\]$", "", cleaned.strip())
        return cleaned.strip() or None

    @staticmethod
    def _merge_descriptions(*parts: str | None) -> str | None:
        """Combine description fragments, avoiding duplicate text."""
        merged = ""
        for part in parts:
            text = (part or "").strip()
            if not text:
                continue
            if not merged:
                merged = text
                continue
            if text in merged or merged in text:
                merged = text if len(text) > len(merged) else merged
                continue
            merged = f"{merged}\n\n{text}"

        return merged or None
