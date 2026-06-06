import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config.settings import get_settings
from app.services.news_service import NewsService

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


async def _scheduled_news_fetch() -> None:
    settings = get_settings()
    if not settings.news_fetch_enabled:
        logger.info("Scheduled news fetch skipped (NEWS_FETCH_ENABLED=false)")
        return

    try:
        stats = await NewsService().collect_all()
        logger.info(
            "Scheduled news fetch finished",
            extra={
                "inserted": stats.inserted,
                "skipped": stats.skipped_duplicates,
                "errors": stats.errors,
            },
        )
    except Exception as exc:
        logger.exception("Scheduled news fetch failed: %s", exc)


def start_scheduler() -> None:
    settings = get_settings()
    if not settings.news_fetch_enabled:
        logger.info("News scheduler disabled (NEWS_FETCH_ENABLED=false)")
        return

    interval = settings.news_fetch_interval_minutes
    scheduler.add_job(
        _scheduled_news_fetch,
        "interval",
        minutes=interval,
        id="news_collection",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("News scheduler started", extra={"interval_minutes": interval})


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("News scheduler stopped")
