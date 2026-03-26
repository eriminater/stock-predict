"""Prediction endpoints."""

import logging
from fastapi import APIRouter
from db.supabase_client import get_supabase
from services.prediction_models import (
    predict_original,
    predict_volatility,
    predict_regression,
    calculate_accuracy_stats,
)
from datetime import date, datetime
from zoneinfo import ZoneInfo

JST = ZoneInfo("Asia/Tokyo")

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/predictions", tags=["predictions"])


@router.get("/{pair_id}")
async def get_predictions(pair_id: str):
    """Get latest predictions for a pair."""
    sb = get_supabase()
    res = (
        sb.table("predictions")
        .select("*")
        .eq("pair_id", pair_id)
        .order("target_date", desc=True)
        .limit(3)
        .execute()
    )
    return res.data


@router.get("/{pair_id}/history")
async def get_prediction_history(pair_id: str, days: int = 30):
    """Get prediction history with accuracy stats."""
    sb = get_supabase()
    res = (
        sb.table("predictions")
        .select("*")
        .eq("pair_id", pair_id)
        .order("target_date", desc=True)
        .limit(days * 3)
        .execute()
    )
    predictions = res.data

    stats = {}
    for model_type in ["original", "volatility", "regression"]:
        model_preds = [p for p in predictions if p["model_type"] == model_type]
        stats[model_type] = calculate_accuracy_stats(model_preds, days)

    return {"predictions": predictions, "stats": stats}


@router.post("/calculate")
async def calculate_predictions():
    """Calculate predictions for all pairs."""
    sb = get_supabase()
    pairs = sb.table("pairs").select("*").execute().data
    results = []

    for pair in pairs:
        result = await _calculate_pair_predictions(sb, pair)
        results.append(result)

    return {"status": "success", "results": results}


async def _calculate_pair_predictions(sb, pair: dict) -> dict:
    """Calculate all 3 prediction models for a single pair."""
    us_ticker = pair["us_ticker"]
    jp_ticker = pair["jp_ticker"]
    ind_ticker = pair["industry_ticker"]

    # Fetch recent prices
    us_prices = _get_prices(sb, us_ticker, 95)
    jp_prices = _get_prices(sb, jp_ticker, 95)
    fx_prices = _get_prices(sb, "USDJPY=X", 95)
    ind_prices = _get_prices(sb, ind_ticker, 95)

    if len(us_prices) < 2 or len(jp_prices) < 2 or len(fx_prices) < 2:
        return {"pair_id": pair["id"], "error": "insufficient data"}

    us_latest = us_prices[0]["close"] or 0
    us_prev = us_prices[1]["close"] or 0
    jp_latest = jp_prices[0]["close"] or 0
    fx_latest = fx_prices[0]["close"] or 0
    fx_prev = fx_prices[1]["close"] or 0
    if not all([us_latest, us_prev, jp_latest, fx_latest, fx_prev]):
        return {"pair_id": pair["id"], "error": "missing price data"}
    target = datetime.now(JST).date().isoformat()

    # Date labels for parameters
    us_date_latest = us_prices[0]["date"]
    us_date_prev = us_prices[1]["date"]
    fx_date_latest = fx_prices[0]["date"]
    fx_date_prev = fx_prices[1]["date"]
    jp_date_latest = jp_prices[0]["date"]

    # Model 1: Original
    m1 = predict_original(us_latest, us_prev, fx_latest, fx_prev, jp_latest)
    m1["parameters"]["us_date_latest"] = us_date_latest
    m1["parameters"]["us_date_prev"] = us_date_prev
    m1["parameters"]["fx_date_latest"] = fx_date_latest
    m1["parameters"]["fx_date_prev"] = fx_date_prev
    m1["parameters"]["jp_date_latest"] = jp_date_latest

    # Model 2: Volatility
    us_returns = _calc_returns([p["close"] for p in us_prices[:91]])
    jp_returns = _calc_returns([p["close"] for p in jp_prices[:91]])
    m2 = predict_volatility(
        us_latest, us_prev, fx_latest, fx_prev, jp_latest, jp_returns, us_returns
    )
    m2["parameters"]["us_close_latest"] = us_latest
    m2["parameters"]["us_close_prev"] = us_prev
    m2["parameters"]["fx_latest"] = fx_latest
    m2["parameters"]["fx_prev"] = fx_prev
    m2["parameters"]["us_date_latest"] = us_date_latest
    m2["parameters"]["us_date_prev"] = us_date_prev
    m2["parameters"]["fx_date_latest"] = fx_date_latest
    m2["parameters"]["fx_date_prev"] = fx_date_prev
    m2["parameters"]["jp_date_latest"] = jp_date_latest

    # Model 3: Regression
    us_closes = [p["close"] for p in reversed(us_prices[:91])]
    jp_closes = [p["close"] for p in reversed(jp_prices[:91])]
    jp_opens = [p["open"] or p["close"] for p in reversed(jp_prices[:91])]
    fx_closes = [p["close"] for p in reversed(fx_prices[:91])]
    ind_closes = [p["close"] for p in reversed(ind_prices[:91])] if len(ind_prices) >= 2 else us_closes
    m3 = predict_regression(us_closes, jp_closes, jp_opens, fx_closes, ind_closes)

    # Save all 3 predictions
    for m in [m1, m2, m3]:
        sb.table("predictions").upsert(
            {
                "pair_id": pair["id"],
                "target_date": target,
                "model_type": m["model_type"],
                "predicted_open": m["predicted_open"],
                "parameters": m["parameters"],
            },
            on_conflict="pair_id,target_date,model_type",
        ).execute()

    return {
        "pair_id": pair["id"],
        "predictions": {
            "original": m1["predicted_open"],
            "volatility": m2["predicted_open"],
            "regression": m3["predicted_open"],
        },
    }


@router.post("/backfill")
async def backfill_predictions():
    """Back-calculate predictions for the past 30 trading days using historical data."""
    sb = get_supabase()
    pairs = sb.table("pairs").select("*").execute().data
    results = []

    for pair in pairs:
        try:
            result = await _backfill_pair(sb, pair)
            results.append(result)
        except Exception as e:
            logger.error(f"Backfill failed for {pair['id']}: {e}")
            results.append({"pair_id": pair["id"], "error": str(e)})

    return {"status": "success", "results": results}


async def _backfill_pair(sb, pair: dict) -> dict:
    """Generate historical predictions for a pair using past price data."""
    us_ticker = pair["us_ticker"]
    jp_ticker = pair["jp_ticker"]
    ind_ticker = pair["industry_ticker"]

    # Get all price data (desc order)
    us_all = _get_prices(sb, us_ticker, 180)
    jp_all = _get_prices(sb, jp_ticker, 180)
    fx_all = _get_prices(sb, "USDJPY=X", 180)
    ind_all = _get_prices(sb, ind_ticker, 180)

    if len(us_all) < 92 or len(jp_all) < 92 or len(fx_all) < 92:
        return {"pair_id": pair["id"], "error": "insufficient historical data"}

    count = 0
    # For each of the past ~35 trading days, calculate predictions
    for day_idx in range(0, min(35, len(jp_all) - 91)):
        # Prices as if we were on that day
        us_prices = us_all[day_idx:]
        jp_prices = jp_all[day_idx:]
        fx_prices = fx_all[day_idx:]
        ind_prices = ind_all[day_idx:] if len(ind_all) > day_idx else us_all[day_idx:]

        if len(us_prices) < 2 or len(jp_prices) < 2 or len(fx_prices) < 2:
            continue

        us_latest = us_prices[0]["close"]
        us_prev = us_prices[1]["close"]
        jp_latest = jp_prices[0]["close"]
        fx_latest = fx_prices[0]["close"]
        fx_prev = fx_prices[1]["close"]

        if not all([us_latest, us_prev, jp_latest, fx_latest, fx_prev]):
            continue

        # The prediction target is the NEXT trading day's JP open
        # Use jp_all[day_idx] date as the prediction date (that day's data predicts that day's open)
        # Actually: we predict today's JP open using yesterday's US close
        # So target_date = jp_prices[0]["date"] and actual_open = jp_prices[0]["open"]
        target_date = jp_prices[0]["date"]
        actual_open = jp_prices[0]["open"]

        # Date labels
        us_date_latest = us_prices[0]["date"]
        us_date_prev = us_prices[1]["date"]
        fx_date_latest = fx_prices[0]["date"]
        fx_date_prev = fx_prices[1]["date"]
        jp_date_latest = jp_prices[0]["date"]

        # Model 1: Original
        m1 = predict_original(us_latest, us_prev, fx_latest, fx_prev, jp_latest)
        m1["parameters"]["us_date_latest"] = us_date_latest
        m1["parameters"]["us_date_prev"] = us_date_prev
        m1["parameters"]["fx_date_latest"] = fx_date_latest
        m1["parameters"]["fx_date_prev"] = fx_date_prev
        m1["parameters"]["jp_date_latest"] = jp_date_latest

        # Model 2: Volatility
        us_returns = _calc_returns([p["close"] for p in us_prices[:91]])
        jp_returns = _calc_returns([p["close"] for p in jp_prices[:91]])
        m2 = predict_volatility(
            us_latest, us_prev, fx_latest, fx_prev, jp_latest, jp_returns, us_returns
        )
        m2["parameters"]["us_close_latest"] = us_latest
        m2["parameters"]["us_close_prev"] = us_prev
        m2["parameters"]["fx_latest"] = fx_latest
        m2["parameters"]["fx_prev"] = fx_prev
        m2["parameters"]["us_date_latest"] = us_date_latest
        m2["parameters"]["us_date_prev"] = us_date_prev
        m2["parameters"]["fx_date_latest"] = fx_date_latest
        m2["parameters"]["fx_date_prev"] = fx_date_prev
        m2["parameters"]["jp_date_latest"] = jp_date_latest

        # Model 3: Regression
        us_closes = [p["close"] for p in reversed(us_prices[:91])]
        jp_closes = [p["close"] for p in reversed(jp_prices[:91])]
        jp_opens = [p["open"] or p["close"] for p in reversed(jp_prices[:91])]
        fx_closes = [p["close"] for p in reversed(fx_prices[:91])]
        ind_closes = [p["close"] for p in reversed(ind_prices[:91])] if len(ind_prices) >= 91 else us_closes
        m3 = predict_regression(us_closes, jp_closes, jp_opens, fx_closes, ind_closes)

        for m in [m1, m2, m3]:
            error_pct = None
            if actual_open and actual_open > 0:
                error_pct = round(((m["predicted_open"] - actual_open) / actual_open) * 100, 4)
            sb.table("predictions").upsert(
                {
                    "pair_id": pair["id"],
                    "target_date": target_date,
                    "model_type": m["model_type"],
                    "predicted_open": m["predicted_open"],
                    "actual_open": actual_open,
                    "error_pct": error_pct,
                    "parameters": m["parameters"],
                },
                on_conflict="pair_id,target_date,model_type",
            ).execute()

        count += 1

    return {"pair_id": pair["id"], "days_backfilled": count}


def _get_prices(sb, ticker: str, limit: int) -> list[dict]:
    res = (
        sb.table("stock_prices")
        .select("*")
        .eq("ticker", ticker)
        .order("date", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data


def _calc_returns(closes: list[float]) -> list[float]:
    returns = []
    for i in range(1, len(closes)):
        if closes[i - 1] and closes[i - 1] > 0:
            returns.append((closes[i] - closes[i - 1]) / closes[i - 1])
    return returns
