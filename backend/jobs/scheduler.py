"""APScheduler setup for daily jobs."""

import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger(__name__)


def setup_scheduler() -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler(timezone="Asia/Tokyo")

    # 5:01 JST - First data fetch (after US market close at ~5:00 JST / 16:00 ET)
    scheduler.add_job(
        _run_daily_fetch,
        CronTrigger(hour=5, minute=1, timezone="Asia/Tokyo"),
        id="daily_fetch_1",
        name="Daily data fetch (5:01)",
    )

    # 5:05 JST - Retry 1
    scheduler.add_job(
        _run_daily_fetch,
        CronTrigger(hour=5, minute=5, timezone="Asia/Tokyo"),
        id="daily_fetch_2",
        name="Daily data fetch retry (5:05)",
    )

    # 5:10 JST - Retry 2
    scheduler.add_job(
        _run_daily_fetch,
        CronTrigger(hour=5, minute=10, timezone="Asia/Tokyo"),
        id="daily_fetch_3",
        name="Daily data fetch retry (5:10)",
    )

    # 5:15 JST - Retry 3
    scheduler.add_job(
        _run_daily_fetch,
        CronTrigger(hour=5, minute=15, timezone="Asia/Tokyo"),
        id="daily_fetch_4",
        name="Daily data fetch retry (5:15)",
    )

    # 9:00 JST - Morning actual open prices
    scheduler.add_job(
        _run_morning_fetch,
        CronTrigger(hour=9, minute=0, timezone="Asia/Tokyo"),
        id="morning_actual",
        name="Morning actual fetch (9:00)",
    )

    # 9:05 JST - Retry 1
    scheduler.add_job(
        _run_morning_fetch,
        CronTrigger(hour=9, minute=5, timezone="Asia/Tokyo"),
        id="morning_actual_retry1",
        name="Morning actual fetch retry (9:05)",
    )

    # 9:10 JST - Retry 2
    scheduler.add_job(
        _run_morning_fetch,
        CronTrigger(hour=9, minute=10, timezone="Asia/Tokyo"),
        id="morning_actual_retry2",
        name="Morning actual fetch retry (9:10)",
    )

    # 9:15 JST - Retry 3
    scheduler.add_job(
        _run_morning_fetch,
        CronTrigger(hour=9, minute=15, timezone="Asia/Tokyo"),
        id="morning_actual_retry3",
        name="Morning actual fetch retry (9:15)",
    )

    return scheduler


async def _run_daily_fetch():
    from jobs.daily_fetch import daily_data_fetch
    try:
        await daily_data_fetch()
    except Exception as e:
        logger.error(f"Daily fetch job failed: {e}")


async def _run_morning_fetch():
    from jobs.daily_fetch import morning_actual_fetch
    try:
        await morning_actual_fetch()
    except Exception as e:
        logger.error(f"Morning fetch job failed: {e}")
