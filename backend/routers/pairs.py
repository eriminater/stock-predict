"""Pair management endpoints."""

import logging
from fastapi import APIRouter, HTTPException
from models.schemas import PairCreate, PairResponse
from db.supabase_client import get_supabase

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/pairs", tags=["pairs"])

MAX_PAIRS = 10


@router.get("", response_model=list[PairResponse])
async def list_pairs():
    sb = get_supabase()
    res = sb.table("pairs").select("*").order("sort_order").execute()
    return res.data


@router.post("", response_model=PairResponse)
async def create_pair(pair: PairCreate):
    sb = get_supabase()
    existing = sb.table("pairs").select("id").execute()
    if len(existing.data) >= MAX_PAIRS:
        raise HTTPException(400, "登録上限（10ペア）に達しています。既存ペアを削除してから追加してください")

    next_order = len(existing.data) + 1
    row = {
        "us_ticker": pair.us_ticker.upper(),
        "jp_ticker": pair.jp_ticker,
        "industry_ticker": pair.industry_ticker,
        "display_name_us": pair.display_name_us,
        "display_name_jp": pair.display_name_jp,
        "display_name_industry": pair.display_name_industry,
        "sort_order": next_order,
    }
    res = sb.table("pairs").insert(row).execute()
    return res.data[0]


@router.delete("/{pair_id}")
async def delete_pair(pair_id: str):
    sb = get_supabase()
    # Cascade delete predictions
    sb.table("predictions").delete().eq("pair_id", pair_id).execute()
    sb.table("pairs").delete().eq("id", pair_id).execute()
    return {"status": "deleted"}


@router.post("/{pair_id}/refresh-names")
async def refresh_display_names(pair_id: str):
    """Fetch and update display names for a pair (useful for pairs missing names)."""
    import asyncio
    from services.yfinance_client import fetch_ticker_name, fetch_jp_name_from_kabutan

    sb = get_supabase()
    pair = sb.table("pairs").select("*").eq("id", pair_id).single().execute().data
    if not pair:
        raise HTTPException(404, "Pair not found")

    updates = {}
    if not pair.get("display_name_us"):
        name = await asyncio.to_thread(fetch_ticker_name, pair["us_ticker"])
        if name:
            updates["display_name_us"] = name
    if not pair.get("display_name_jp"):
        name = await fetch_jp_name_from_kabutan(pair["jp_ticker"])
        if not name:
            name = await asyncio.to_thread(fetch_ticker_name, pair["jp_ticker"])
        if name:
            updates["display_name_jp"] = name
    if not pair.get("display_name_industry"):
        name = await asyncio.to_thread(fetch_ticker_name, pair["industry_ticker"])
        if name:
            updates["display_name_industry"] = name

    if updates:
        sb.table("pairs").update(updates).eq("id", pair_id).execute()
        logger.info(f"Refreshed display names for {pair_id}: {updates}")
    return {"updated": updates}


@router.post("/{pair_id}/initialize")
async def initialize_pair(pair_id: str):
    """Fetch 180-day data, calculate predictions, and backfill for a new pair."""
    import asyncio
    from services.data_fetcher import fetch_with_fallback, save_prices_to_db
    from routers.predictions import _calculate_pair_predictions, _backfill_pair

    sb = get_supabase()
    pair = sb.table("pairs").select("*").eq("id", pair_id).single().execute().data
    if not pair:
        raise HTTPException(404, "Pair not found")

    us_ticker = pair["us_ticker"]
    jp_ticker = pair["jp_ticker"]
    ind_ticker = pair["industry_ticker"]

    # Step 0: Fetch and save display names if not already set
    try:
        from services.yfinance_client import fetch_ticker_name, fetch_jp_name_from_kabutan
        updates = {}
        if not pair.get("display_name_us"):
            name = await asyncio.to_thread(fetch_ticker_name, us_ticker)
            if name:
                updates["display_name_us"] = name
        if not pair.get("display_name_jp"):
            # JP tickers: try Kabutan first for Japanese names, fallback to yfinance
            name = await fetch_jp_name_from_kabutan(jp_ticker)
            if not name:
                name = await asyncio.to_thread(fetch_ticker_name, jp_ticker)
            if name:
                updates["display_name_jp"] = name
        if not pair.get("display_name_industry"):
            name = await asyncio.to_thread(fetch_ticker_name, ind_ticker)
            if name:
                updates["display_name_industry"] = name
        if updates:
            sb.table("pairs").update(updates).eq("id", pair_id).execute()
            logger.info(f"Updated display names for {pair_id}: {updates}")
    except Exception as e:
        logger.warning(f"Display name fetch failed for {pair_id}: {e}")

    # Step 1: Fetch 180 days of price data
    errors = []
    for ticker, market in [
        (us_ticker, "us"),
        (jp_ticker, "jp"),
        (ind_ticker, "industry"),
        ("USDJPY=X", "fx"),
    ]:
        for attempt in range(3):
            try:
                data = await fetch_with_fallback(ticker, days=180)
                if data:
                    await save_prices_to_db(sb, ticker, market, data)
                    logger.info(f"Fetched {len(data)} rows for {ticker}")
                    break
                await asyncio.sleep(2)
            except Exception as e:
                logger.warning(f"Fetch attempt {attempt+1} failed for {ticker}: {e}")
                await asyncio.sleep(2)
                if attempt == 2:
                    errors.append(f"{ticker}: {e}")

    # Step 2: Calculate today's predictions
    try:
        pred_result = await _calculate_pair_predictions(sb, pair)
    except Exception as e:
        pred_result = {"error": str(e)}
        logger.error(f"Prediction calc failed for {pair_id}: {e}")

    # Step 3: Backfill historical predictions
    try:
        backfill_result = await _backfill_pair(sb, pair)
    except Exception as e:
        backfill_result = {"error": str(e)}
        logger.error(f"Backfill failed for {pair_id}: {e}")

    return {
        "status": "success" if not errors else "partial",
        "pair_id": pair_id,
        "fetch_errors": errors,
        "predictions": pred_result,
        "backfill": backfill_result,
    }
