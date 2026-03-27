"""Data fetching endpoints."""

from fastapi import APIRouter
from db.supabase_client import get_supabase
from services.data_fetcher import fetch_with_fallback, save_prices_to_db
from models.schemas import FetchStatusResponse

router = APIRouter(prefix="/api/data", tags=["data"])


@router.post("/fetch", response_model=FetchStatusResponse)
async def fetch_all_data():
    """Manually trigger data fetch for all pairs."""
    import logging, asyncio
    from datetime import datetime
    logger = logging.getLogger(__name__)

    sb = get_supabase()
    pairs = sb.table("pairs").select("*").execute().data

    tickers_fetched = []
    errors = []
    for pair in pairs:
        for ticker, market in [
            (pair["us_ticker"], "us"),
            (pair["jp_ticker"], "jp"),
            (pair["industry_ticker"], "industry"),
        ]:
            if ticker and ticker not in tickers_fetched:
                try:
                    data = await fetch_with_fallback(ticker)
                    await save_prices_to_db(sb, ticker, market, data)
                    tickers_fetched.append(ticker)
                    await asyncio.sleep(1)  # Rate limit
                except Exception as e:
                    logger.error(f"Fetch failed for {ticker}: {e}")
                    errors.append(f"{ticker}: {str(e)}")

    # Always fetch FX
    if "USDJPY=X" not in tickers_fetched:
        try:
            fx_data = await fetch_with_fallback("USDJPY=X")
            await save_prices_to_db(sb, "USDJPY=X", "fx", fx_data)
        except Exception as e:
            errors.append(f"USDJPY=X: {str(e)}")

    # Update predictions.actual_open with today's open from stock_prices
    try:
        from jobs.daily_fetch import morning_actual_fetch
        await morning_actual_fetch()
    except Exception as e:
        logger.error(f"morning_actual_fetch failed: {e}")

    msg = f"{len(tickers_fetched)+1}銘柄のデータを取得しました"
    if errors:
        msg += f"（エラー: {', '.join(errors)}）"
    return FetchStatusResponse(
        status="success" if not errors else "partial",
        message=msg,
        fetched_at=datetime.utcnow().isoformat(),
    )


@router.post("/fetch/{pair_id}", response_model=FetchStatusResponse)
async def fetch_pair_data(pair_id: str):
    """Fetch data for a specific pair."""
    sb = get_supabase()
    pair = sb.table("pairs").select("*").eq("id", pair_id).single().execute().data

    for ticker, market in [
        (pair["us_ticker"], "us"),
        (pair["jp_ticker"], "jp"),
        (pair["industry_ticker"], "industry"),
    ]:
        if ticker:
            data = await fetch_with_fallback(ticker)
            await save_prices_to_db(sb, ticker, market, data)

    fx_data = await fetch_with_fallback("USDJPY=X")
    await save_prices_to_db(sb, "USDJPY=X", "fx", fx_data)

    from datetime import datetime
    return FetchStatusResponse(
        status="success",
        message="データ取得完了",
        fetched_at=datetime.utcnow().isoformat(),
    )


@router.post("/fetch-us-close", response_model=FetchStatusResponse)
async def fetch_us_close():
    """Fetch only US stock/index/FX closing prices and recalculate predictions."""
    import logging, asyncio
    from datetime import datetime
    logger = logging.getLogger(__name__)

    sb = get_supabase()
    pairs = sb.table("pairs").select("*").execute().data

    fetched_tickers = set()
    errors = []
    for pair in pairs:
        for ticker, market in [
            (pair["us_ticker"], "us"),
            (pair["industry_ticker"], "industry"),
        ]:
            if ticker and ticker not in fetched_tickers:
                try:
                    data = await fetch_with_fallback(ticker)
                    await save_prices_to_db(sb, ticker, market, data)
                    fetched_tickers.add(ticker)
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Fetch failed for {ticker}: {e}")
                    errors.append(f"{ticker}: {str(e)}")

    try:
        fx_data = await fetch_with_fallback("USDJPY=X")
        await save_prices_to_db(sb, "USDJPY=X", "fx", fx_data)
    except Exception as e:
        errors.append(f"USDJPY=X: {str(e)}")

    try:
        from routers.predictions import _calculate_pair_predictions
        for pair in pairs:
            await _calculate_pair_predictions(sb, pair)
    except Exception as e:
        logger.error(f"Prediction calc failed: {e}")

    msg = f"US株・指数・FX ({len(fetched_tickers)+1}銘柄) を更新しました"
    if errors:
        msg += f"（エラー: {', '.join(errors)}）"
    return FetchStatusResponse(status="success" if not errors else "partial", message=msg, fetched_at=datetime.utcnow().isoformat())


@router.post("/fetch-actual-open", response_model=FetchStatusResponse)
async def fetch_actual_open():
    """Run morning_actual_fetch only: updates JP open prices without touching US data."""
    from datetime import datetime
    try:
        from jobs.daily_fetch import morning_actual_fetch
        await morning_actual_fetch()
        return FetchStatusResponse(status="success", message="始値を更新しました", fetched_at=datetime.utcnow().isoformat())
    except Exception as e:
        return FetchStatusResponse(status="error", message=str(e), fetched_at=datetime.utcnow().isoformat())


@router.get("/validate/{ticker}")
async def validate_ticker(ticker: str):
    """Check if a ticker symbol is valid by attempting a small data fetch."""
    data = await fetch_with_fallback(ticker, days=5)
    return {"valid": bool(data)}


@router.get("/prices/{ticker}")
async def get_prices(ticker: str, days: int = 30):
    """Get price data from DB."""
    sb = get_supabase()
    res = (
        sb.table("stock_prices")
        .select("*")
        .eq("ticker", ticker)
        .order("date", desc=True)
        .limit(days)
        .execute()
    )
    return res.data
