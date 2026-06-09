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
from app.services.relevance_filter import is_relevant_event

logger = logging.getLogger(__name__)

RSS_FEEDS: dict[str, str] = {
    # GEOPOLITICAL
    "Reuters World News": "https://news.google.com/rss/search?q=site:reuters.com+world&hl=en-US&gl=US&ceid=US:en",
    "AP News": "https://news.google.com/rss/search?q=site:apnews.com&hl=en-US&gl=US&ceid=US:en",
    "BBC World News": "http://feeds.bbci.co.uk/news/world/rss.xml",
    "Al Jazeera": "https://www.aljazeera.com/xml/rss/all.xml",
    "DW News": "https://rss.dw.com/rdf/rss-en-world",
    "France24": "https://www.france24.com/en/rss",
    "Financial Times": "https://news.google.com/rss/search?q=site:ft.com&hl=en-US&gl=US&ceid=US:en",
    "The Guardian": "https://www.theguardian.com/world/rss",
    # MARKETS
    "CNBC News": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
    "Investing.com": "https://www.investing.com/rss/news.rss",
    "Bloomberg (Syndicated)": "https://news.google.com/rss/search?q=site:bloomberg.com&hl=en-US&gl=US&ceid=US:en",
    # ENERGY
    "OilPrice.com": "https://oilprice.com/rss/main",
    "EIA Updates": "https://news.google.com/rss/search?q=site:eia.gov&hl=en-US&gl=US&ceid=US:en",
    # CRYPTO
    "CoinDesk": "https://www.coindesk.com/arc/outboundfeeds/rss/",
    "CoinTelegraph": "https://cointelegraph.com/rss",
    # INDIA
    "Economic Times": "https://economictimes.indiatimes.com/rssfeedstopstories.cms",
    "Business Standard": "https://www.business-standard.com/rss/home_page_top_stories.rss",
    "Mint": "https://www.livemint.com/rss/news",
}

GNEWS_HEADLINES_URL = "https://gnews.io/api/v4/top-headlines"
GNEWS_SEARCH_URL = "https://gnews.io/api/v4/search"

# Extra search queries for unique articles beyond world headlines.
GNEWS_SEARCH_QUERIES: tuple[str, ...] = (
    "global economy markets",
    "geopolitics conflict trade",
)

MARKETAUX_API_URL = "https://api.marketaux.com/v1/news/all"


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

        if self._marketaux_configured():
            marketaux_items, marketaux_errors = await self._fetch_marketaux()
            stats.errors.extend(marketaux_errors)
            normalized.extend(marketaux_items)
            stats.sources["marketaux"] = len(marketaux_items)
        else:
            logger.warning("MARKETAUX_API_KEY not set or disabled — skipping Marketaux fetch")
            stats.sources["marketaux"] = 0

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

    async def fetch_targeted_news(self, query: str, limit: int = 5) -> int:
        """Dynamically fetch news for a specific query and store it."""
        events: list[NormalizedEvent] = []
        seen_urls: set[str] = set()

        if self._gnews_configured():
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    articles, error = await self._gnews_get_safe(
                        client,
                        GNEWS_SEARCH_URL,
                        {
                            "q": query,
                            "lang": "en",
                            "max": limit,
                            "apikey": self.settings.gnews_api_key,
                        },
                    )
                    if error:
                        logger.error(f"Targeted GNews fetch failed: {error}")
                    for article in articles:
                        self._append_gnews_article(article, events, seen_urls)
            except Exception as e:
                logger.error(f"Targeted GNews fetch error: {e}")

        if self._marketaux_configured() and len(events) < limit:
            try:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.get(
                        MARKETAUX_API_URL,
                        params={
                            "api_token": self.settings.marketaux_api_key,
                            "search": query,
                            "language": "en",
                            "limit": limit - len(events),
                        },
                    )
                    if response.status_code == 200:
                        data = response.json()
                        for article in data.get("data") or []:
                            event = self._normalize_marketaux_article(article)
                            if event and event.url not in seen_urls:
                                seen_urls.add(event.url)
                                events.append(event)
            except Exception as e:
                logger.error(f"Targeted Marketaux fetch error: {e}")

        if not events:
            return 0

        inserted, _, _ = self._store_events(events)
        logger.info(f"Dynamic fetch for '{query}' inserted {inserted} new events")
        return inserted


    def _gnews_configured(self) -> bool:
        key = self.settings.gnews_api_key.strip()
        if not key or key == "your-gnews-api-key":
            if key == "your-gnews-api-key":
                logger.warning("GNEWS_API_KEY is still the placeholder — update .env and restart")
            else:
                logger.warning("GNEWS_API_KEY not set — skipping GNews fetch")
            return False
        return True

    def _marketaux_configured(self) -> bool:
        if not self.settings.enable_marketaux:
            return False
        key = self.settings.marketaux_api_key.strip()
        if not key or key == "your-marketaux-api-key":
            return False
        return True

    async def _fetch_marketaux(self) -> tuple[list[NormalizedEvent], list[str]]:
        events: list[NormalizedEvent] = []
        errors: list[str] = []
        api_key = self.settings.marketaux_api_key

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(
                    MARKETAUX_API_URL,
                    params={
                        "api_token": api_key,
                        "language": "en",
                        "limit": 3,
                    },
                )
                response.raise_for_status()
                data = response.json()
                articles = data.get("data") or []
                for article in articles:
                    event = self._normalize_marketaux_article(article)
                    if event:
                        events.append(event)
            logger.info("Marketaux fetched", extra={"count": len(events)})
        except httpx.HTTPError as exc:
            msg = f"Marketaux unavailable: {exc}"
            logger.error(msg)
            errors.append(msg)
        except Exception as exc:
            msg = f"Marketaux error: {exc}"
            logger.exception(msg)
            errors.append(msg)
        return events, errors

    def _normalize_marketaux_article(self, article: dict[str, Any]) -> NormalizedEvent | None:
        url = self._normalize_url(article.get("url") or "")
        title = (article.get("title") or "").strip()
        if not url or not title:
            return None

        published_at = None
        if article.get("published_at"):
            try:
                published_at = datetime.fromisoformat(
                    article["published_at"].replace("Z", "+00:00")
                )
            except ValueError:
                pass

        description = self._clean_text(article.get("description"))
        return NormalizedEvent(
            title=title,
            description=description,
            source=f"Marketaux — {article.get('source', 'Unknown')}",
            url=url,
            published_at=published_at,
        )

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

        existing_urls, existing_titles, existing_by_url, existing_by_title = self._load_existing_keys()
        inserted = skipped = enriched = 0
        batch_urls: set[str] = set()
        batch_titles: set[str] = set()

        for event in events:
            norm_url = self._normalize_url(event.url)
            norm_title = self._normalize_title(event.title)

            # Strict duplicate URL skip
            if norm_url in existing_urls or norm_url in batch_urls:
                if self._maybe_enrich_description(existing_by_url.get(norm_url), event):
                    enriched += 1
                skipped += 1
                continue

            # Clustering: If title is existing, it's a new source for the same event
            if norm_title in existing_titles or norm_title in batch_titles:
                parent_event_id = existing_by_title.get(norm_title)
                if parent_event_id:
                    self._add_event_source(parent_event_id, event)
                skipped += 1
                continue

            # Calculate Relevance — hard skip if irrelevant (do NOT store sports/entertainment etc.)
            is_relevant, reason, relevance_score, intelligence_priority = is_relevant_event(event.title, event.description)
            if not is_relevant:
                logger.debug(
                    "Event rejected as irrelevant — not stored",
                    extra={"title": event.title[:80], "reason": reason, "score": relevance_score},
                )
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
                    "relevance_score": relevance_score,
                    "intelligence_priority": intelligence_priority,
                    "source_count": 1,
                }
                result = self.db.table(EVENTS_TABLE).insert(row).execute()
                new_event_id = result.data[0]["id"] if result.data else None
                
                if new_event_id:
                    self._add_event_source(new_event_id, event)
                    
                existing_urls.add(norm_url)
                existing_titles.add(norm_title)
                batch_urls.add(norm_url)
                batch_titles.add(norm_title)
                if new_event_id:
                    existing_by_title[norm_title] = new_event_id
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

    def _add_event_source(self, event_id: str, event: NormalizedEvent) -> None:
        try:
            self.db.table("event_sources").insert({
                "event_id": event_id,
                "url": self._normalize_url(event.url),
                "source": event.source,
                "title": event.title,
                "published_at": event.published_at.isoformat() if event.published_at else None,
            }).execute()
            
            # Increment source_count (requires calling a supabase rpc or updating directly)
            # Since Supabase python client doesn't support atomic increment easily via direct update,
            # we rely on the schema or a trigger, but for now we just log it.
            # Ideally: update events set source_count = source_count + 1 where id = event_id
        except Exception as exc:
            if not self._is_duplicate_url_error(exc):
                logger.warning("Failed to add event_source", extra={"event_id": event_id, "url": event.url, "error": str(exc)})

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
    ) -> tuple[set[str], set[str], dict[str, dict[str, Any]], dict[str, str]]:
        urls: set[str] = set()
        titles: set[str] = set()
        by_url: dict[str, dict[str, Any]] = {}
        by_title: dict[str, str] = {}
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
                        norm_title = self._normalize_title(row["title"])
                        titles.add(norm_title)
                        by_title[norm_title] = row["id"]

                if len(rows) < page_size:
                    break
                offset += page_size
        except Exception as exc:
            logger.exception("Failed to load existing events for deduplication")
            raise SupabaseQueryError(
                f"Failed to load existing events: {exc}", table=EVENTS_TABLE
            ) from exc

        return urls, titles, by_url, by_title

    def list_events(
        self,
        *,
        limit: int = 20,
        offset: int = 0,
        search_query: str | None = None,
        country: str | None = None,
        region: str | None = None,
        asset: str | None = None,
        source: str | None = None,
        sector: str | None = None,
        risk_level: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        category: str | None = None,
        priority: str | None = None,
    ) -> dict[str, Any]:
        try:
            if search_query:
                logger.info(f"Executing deep search for: {search_query}")
                response = self.db.rpc(
                    "search_events_deep", 
                    {"query_text": search_query, "max_limit": limit, "row_offset": offset}
                ).execute()
                
                # Apply post-filters if other filters are present
                filtered_data = response.data
                if source:
                    filtered_data = [d for d in filtered_data if source.lower() in str(d.get("source", "")).lower()]
                if category:
                    filtered_data = [d for d in filtered_data if d.get("analysis", {}) and d["analysis"].get("category") == category]
                if risk_level:
                    filtered_data = [d for d in filtered_data if d.get("analysis", {}) and d["analysis"].get("risk_level") == risk_level]
                if country:
                    filtered_data = [d for d in filtered_data if d.get("analysis", {}) and country in (d["analysis"].get("countries_impacted") or [])]
                if asset:
                    filtered_data = [d for d in filtered_data if d.get("analysis", {}) and asset.lower() in str(d["analysis"].get("market_impacts", [])).lower()]
                if priority:
                    filtered_data = [d for d in filtered_data if str(d.get("intelligence_priority") or "").lower() == priority.lower()]
                
                return {
                    "events": filtered_data,
                    "total": offset + len(filtered_data) + (1 if len(filtered_data) == limit else 0),
                    "limit": limit,
                    "offset": offset,
                }

        # Standard path
            needs_inner = any([country, region, asset, sector, risk_level, category])
            select_str = "*, analysis!inner(*)" if needs_inner else "*, analysis(*)"
            
            query = self.db.table(EVENTS_TABLE).select(select_str, count="exact")

            if source:
                query = query.ilike("source", f"%{source}%")
            if from_date:
                query = query.gte("published_at", from_date)
            if to_date:
                query = query.lte("published_at", to_date)

            if category:
                query = query.eq("analysis.category", category)
            if risk_level:
                query = query.eq("analysis.risk_level", risk_level)
            if sector:
                query = query.ilike("analysis.affected_sectors", f"%{sector}%")
            if country:
                query = query.contains("analysis.countries_impacted", [country])
            if asset:
                query = query.ilike("analysis.market_impacts::text", f"%{asset}%")
            if priority:
                if priority.upper() == "MEDIUM":
                    query = query.or_("intelligence_priority.eq.MEDIUM,intelligence_priority.is.null")
                else:
                    query = query.eq("intelligence_priority", priority.upper())
            response = (
                query
                .or_("relevance_score.gte.50,relevance_score.is.null")  # Never surface sub-threshold events but allow nulls
                .order("relevance_score", desc=True)
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
                .order("relevance_score", desc=True)
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
