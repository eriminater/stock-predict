"""Unified data fetcher with 3-source fallback: Yahoo v8 -> Stooq -> yfinance."""

import asyncio
import logging
from datetime import datetime

from .yahoo_finance import fetch_chart_data
from .stooq import fetch_stooq_data
from .yfinance_client import fetch_yfinance_data

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
BACKOFF_BASE = 2  # seconds（yfinanceレート制限対策で2秒ベースに変更）


async def fetch_with_fallback(ticker: str, days: int = 180) -> list[dict]:
    """Try Yahoo v8 first, then Stooq, then yfinance."""

    # Source 1: Yahoo Finance v8
    for attempt in range(MAX_RETRIES):
        try:
            data = await fetch_chart_data(ticker, range_str=f"{days}d")
            if data:
                logger.info(f"Yahoo v8 success for {ticker}")
                return data
        except Exception as e:
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(f"Yahoo v8 attempt {attempt+1} failed for {ticker}: {e}")
            await asyncio.sleep(wait)

    # Source 2: Stooq
    for attempt in range(MAX_RETRIES):
        try:
            data = await fetch_stooq_data(ticker, days)
            if data:
                logger.info(f"Stooq success for {ticker}")
                return data
        except Exception as e:
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(f"Stooq attempt {attempt+1} failed for {ticker}: {e}")
            await asyncio.sleep(wait)

    # Source 3: yfinance (sync, run in thread)
    for attempt in range(MAX_RETRIES):
        try:
            data = await asyncio.to_thread(fetch_yfinance_data, ticker, days)
            if data:
                logger.info(f"yfinance success for {ticker}")
                return data
        except Exception as e:
            wait = BACKOFF_BASE * (2 ** attempt)
            logger.warning(f"yfinance attempt {attempt+1} failed for {ticker}: {e}")
            await asyncio.sleep(wait)

    logger.error(f"All sources failed for {ticker}")
    return []


async def save_prices_to_db(supabase, ticker: str, market: str, rows: list[dict]):
    """Save fetched price data to Supabase, skipping existing dates."""
    if not rows:
        return
    # Deduplicate by (ticker, date) - keep last occurrence
    seen = {}
    for r in rows:
        key = r["date"]
        seen[key] = {
            "ticker": ticker,
            "market": market,
            "date": r["date"],
            "open": r.get("open"),
            "close": r.get("close"),
            "high": r.get("high"),
            "low": r.get("low"),
            "volume": r.get("volume"),
            "fetched_at": datetime.utcnow().isoformat(),
        }
    records = list(seen.values())
    # Upsert in batches of 50
    for i in range(0, len(records), 50):
        batch = records[i:i+50]
        supabase.table("stock_prices").upsert(
            batch, on_conflict="ticker,date"
        ).execute()
