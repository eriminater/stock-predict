"""Daily data fetch and prediction jobs."""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

from db.supabase_client import get_supabase
from services.data_fetcher import fetch_with_fallback, save_prices_to_db

logger = logging.getLogger(__name__)

JST = ZoneInfo("Asia/Tokyo")
NY = ZoneInfo("America/New_York")


def is_us_market_closed() -> bool:
    """Check if US market is closed (after 16:00 NY time)."""
    now_ny = datetime.now(NY)
    # Weekend
    if now_ny.weekday() >= 5:
        return True
    # After market close (16:00)
    return now_ny.hour >= 16


async def daily_data_fetch():
    """Fetch all stock/fx data and calculate predictions. Runs at 6:00 and 6:15 JST."""
    logger.info("Starting daily data fetch job")

    if not is_us_market_closed():
        logger.info("US market not yet closed, skipping")
        return

    sb = get_supabase()
    pairs = sb.table("pairs").select("*").execute().data

    fetched_tickers = set()
    for pair in pairs:
        for ticker, market in [
            (pair["us_ticker"], "us"),
            (pair["jp_ticker"], "jp"),
            (pair["industry_ticker"], "industry"),
        ]:
            if ticker and ticker not in fetched_tickers:
                data = await fetch_with_fallback(ticker)
                await save_prices_to_db(sb, ticker, market, data)
                fetched_tickers.add(ticker)
                await asyncio.sleep(1)  # Rate limit

    # FX
    if "USDJPY=X" not in fetched_tickers:
        fx_data = await fetch_with_fallback("USDJPY=X")
        await save_prices_to_db(sb, "USDJPY=X", "fx", fx_data)

    # Calculate predictions
    from routers.predictions import _calculate_pair_predictions
    for pair in pairs:
        try:
            await _calculate_pair_predictions(sb, pair)
        except Exception as e:
            logger.error(f"Prediction failed for {pair['id']}: {e}")

    logger.info(f"Daily fetch complete: {len(fetched_tickers)} tickers")


async def morning_actual_fetch():
    """Fetch JP stock opening prices at 9:05 JST and update predictions."""
    logger.info("Starting morning actual fetch job")

    sb = get_supabase()
    pairs = sb.table("pairs").select("*").execute().data
    today = datetime.now(JST).date().isoformat()

    for pair in pairs:
        jp_ticker = pair["jp_ticker"]
        data = await fetch_with_fallback(jp_ticker, days=5)

        if data:
            latest = data[0] if isinstance(data[0], dict) else data[-1]
            actual_open = latest.get("open")
            if actual_open:
                # Update predictions with actual
                preds = (
                    sb.table("predictions")
                    .select("*")
                    .eq("pair_id", pair["id"])
                    .eq("target_date", today)
                    .execute()
                    .data
                )
                for pred in preds:
                    error_pct = ((pred["predicted_open"] - actual_open) / actual_open) * 100
                    sb.table("predictions").update({
                        "actual_open": actual_open,
                        "error_pct": round(error_pct, 4),
                    }).eq("id", pred["id"]).execute()

    logger.info("Morning actual fetch complete")
