"""Analysis endpoints: correlation, returns, pair research."""

from fastapi import APIRouter
from db.supabase_client import get_supabase
from services.data_fetcher import fetch_with_fallback, save_prices_to_db
from services.prediction_models import predict_original, predict_volatility, predict_regression
import numpy as np
import httpx
import re
import asyncio
import math
from datetime import datetime
from zoneinfo import ZoneInfo

_NY = ZoneInfo("America/New_York")

router = APIRouter(prefix="/api/analysis", tags=["analysis"])


def _pearson(x: list[float], y: list[float]) -> float:
    """Pearson correlation: Cov(X,Y) / (σX * σY)"""
    n = len(x)
    if n < 5:
        return 0.0
    xa = np.array(x)
    ya = np.array(y)
    x_mean = xa.mean()
    y_mean = ya.mean()
    cov = np.sum((xa - x_mean) * (ya - y_mean))
    sx = np.sqrt(np.sum((xa - x_mean) ** 2))
    sy = np.sqrt(np.sum((ya - y_mean) ** 2))
    if sx == 0 or sy == 0:
        return 0.0
    r = cov / (sx * sy)
    return round(float(r), 4) if not np.isnan(r) else 0.0


def _pearson_lagged(us_returns: list[float], jp_returns: list[float], period: int, lag: int = 1) -> float:
    """Pearson correlation with 1-day lag: US return on day T vs JP return on day T+1.
    JP markets react to US close the following trading day due to timezone difference."""
    x = us_returns[:-lag] if lag > 0 else us_returns
    y = jp_returns[lag:] if lag > 0 else jp_returns
    x = x[-period:]
    y = y[-period:]
    n = min(len(x), len(y))
    return _pearson(x[:n], y[:n])


def _aligned_closes(prices_a: list[dict], prices_b: list[dict]) -> tuple[list[float], list[float]]:
    """Return closing prices aligned on common dates, sorted ascending."""
    map_a = {p["date"]: p["close"] for p in prices_a if p.get("close")}
    map_b = {p["date"]: p["close"] for p in prices_b if p.get("close")}
    common = sorted(map_a.keys() & map_b.keys())
    return [map_a[d] for d in common], [map_b[d] for d in common]


def _prices_to_returns(prices: list[float]) -> list[float]:
    """Convert price series to daily log returns."""
    import math
    returns = []
    for i in range(1, len(prices)):
        if prices[i - 1] > 0 and prices[i] > 0:
            returns.append(math.log(prices[i] / prices[i - 1]))
    return returns


@router.get("/correlation/{pair_id}")
async def get_correlation(pair_id: str):
    """Get 30/60/90 day Pearson correlation on aligned daily returns."""
    sb = get_supabase()
    pair = sb.table("pairs").select("*").eq("id", pair_id).single().execute().data

    # Fetch one extra day so that N days of returns = N+1 closes
    us_prices = _get_sorted_prices(sb, pair["us_ticker"], 96)
    jp_prices = _get_sorted_prices(sb, pair["jp_ticker"], 96)

    us_closes, jp_closes = _aligned_closes(us_prices, jp_prices)
    us_returns = _prices_to_returns(us_closes)
    jp_returns = _prices_to_returns(jp_closes)

    result = {}
    for period in [30, 60, 90]:
        result[f"period_{period}"] = _pearson_lagged(us_returns, jp_returns, period)

    return result


@router.get("/returns/{pair_id}")
async def get_returns(pair_id: str, days: int = 30):
    """Get daily return data for charts."""
    sb = get_supabase()
    pair = sb.table("pairs").select("*").eq("id", pair_id).single().execute().data

    us_prices = _get_sorted_prices(sb, pair["us_ticker"], days + 1)
    jp_prices = _get_sorted_prices(sb, pair["jp_ticker"], days + 1)

    us_returns = _calc_returns(us_prices)
    jp_returns = _calc_returns(jp_prices)

    dates_us = [p["date"] for p in us_prices[1:]]
    dates_jp = [p["date"] for p in jp_prices[1:]]

    return {
        "us": {"dates": dates_us, "returns": us_returns},
        "jp": {"dates": dates_jp, "returns": jp_returns},
    }


@router.post("/pair-research")
async def pair_research(req: dict):
    """Temporary pair analysis."""
    us_ticker = req.get("us_ticker", "")
    jp_ticker = req.get("jp_ticker", "")
    industry_ticker = req.get("industry_ticker", "^GSPC")

    sb = get_supabase()

    # Fetch data for research tickers
    for ticker, market in [(us_ticker, "us"), (jp_ticker, "jp"), (industry_ticker, "industry"), ("USDJPY=X", "fx")]:
        data = await fetch_with_fallback(ticker)
        await save_prices_to_db(sb, ticker, market, data)

    us_prices = _get_sorted_prices(sb, us_ticker, 96)
    jp_prices = _get_sorted_prices(sb, jp_ticker, 96)
    fx_prices = _get_sorted_prices(sb, "USDJPY=X", 35)

    # Correlation: 30/60/90-day Pearson on aligned daily returns with 1-day lag
    us_closes, jp_closes = _aligned_closes(us_prices, jp_prices)
    us_rets = _prices_to_returns(us_closes)
    jp_rets = _prices_to_returns(jp_closes)

    correlations = {
        f"period_{p}": _pearson_lagged(us_rets, jp_rets, p)
        for p in [30, 60, 90]
    }

    # Simple prediction
    predictions = {}
    if len(us_prices) >= 2 and len(jp_prices) >= 2 and len(fx_prices) >= 2:
        m1 = predict_original(
            us_prices[0]["close"], us_prices[1]["close"],
            fx_prices[0]["close"], fx_prices[1]["close"],
            jp_prices[0]["close"],
        )
        predictions["original"] = m1["predicted_open"]

    return {
        "correlations": correlations,
        "predictions": predictions,
        "us_prices": us_prices[:30],
        "jp_prices": jp_prices[:30],
    }


def _get_sorted_prices(sb, ticker: str, limit: int) -> list[dict]:
    res = (
        sb.table("stock_prices")
        .select("*")
        .eq("ticker", ticker)
        .order("date", desc=True)
        .limit(limit)
        .execute()
    )
    return res.data


def _fetch_us_live_price(ticker: str) -> dict:
    """Fetch latest US stock price including after-hours via yfinance fast_info."""
    try:
        import yfinance as yf
        t = yf.Ticker(ticker)
        fi = t.fast_info
        price = fi.last_price
        if price and float(price) > 0:
            return {"price": round(float(price), 2), "is_live": True}
    except Exception:
        pass
    return {"price": None, "is_live": False}


@router.get("/live-prediction/{pair_id}")
async def get_live_prediction(pair_id: str):
    """Recalculate all 3 models using latest US stock price (incl. after-hours)."""
    sb = get_supabase()
    pair = sb.table("pairs").select("*").eq("id", pair_id).single().execute().data

    # Fetch live US price in thread (yfinance is sync)
    us_live = await asyncio.to_thread(_fetch_us_live_price, pair["us_ticker"])

    # DB prices
    us_prices = _get_sorted_prices(sb, pair["us_ticker"], 3)
    jp_prices = _get_sorted_prices(sb, pair["jp_ticker"], 2)
    fx_prices = _get_sorted_prices(sb, "USDJPY=X", 2)
    ind_prices = _get_sorted_prices(sb, pair["industry_ticker"], 2)

    if not (us_prices and jp_prices and fx_prices):
        return {"error": "insufficient data"}

    # バッチ実行後は us_prices[0] が今日の終値になるため us_prev がずれる問題を修正
    # NY日付で today の終値が DB に保存済みか判定する
    today_ny = datetime.now(_NY).date().isoformat()
    if us_prices[0]["date"] == today_ny and len(us_prices) >= 2:
        # バッチ実行済み: [0]=今日, [1]=昨日
        us_new = us_live["price"] if us_live["price"] else us_prices[0].get("close")
        us_prev = us_prices[1].get("close")
    else:
        # バッチ未実行: [0]=昨日（DBの最新）, live=今日の終値
        us_new = us_live["price"] if us_live["price"] else us_prices[0].get("close")
        us_prev = us_prices[0].get("close")

    jp_close = jp_prices[0].get("close")
    fx_latest = fx_prices[0].get("close")
    fx_prev = fx_prices[1].get("close") if len(fx_prices) >= 2 else fx_latest

    if not all([us_new, us_prev, jp_close, fx_latest, fx_prev]):
        return {"error": "insufficient data"}

    # --- Original ---
    orig_pred = round((us_new / us_prev) * (fx_latest / fx_prev) * jp_close, 2)

    # --- Volatility: 保存済み sensitivity を流用 ---
    stored = sb.table("predictions").select("model_type,parameters").eq("pair_id", pair_id)\
        .order("created_at", desc=True).limit(9).execute().data
    params = {p["model_type"]: (p.get("parameters") or {}) for p in stored}

    sensitivity = params.get("volatility", {}).get("sensitivity", 1.0)
    us_ret = (us_new / us_prev) - 1
    fx_ret = (fx_latest / fx_prev) - 1
    vol_pred = round(jp_close * (1 + us_ret * sensitivity + fx_ret), 2)

    # --- Regression: 保存済み beta 値を流用 ---
    rp = params.get("regression", {})
    beta1, beta2, beta3, alpha = rp.get("beta1"), rp.get("beta2"), rp.get("beta3"), rp.get("alpha", 0)
    reg_pred = None
    if all(v is not None for v in [beta1, beta2, beta3]) and us_prev > 0 and fx_prev > 0:
        ind_latest = ind_prices[0].get("close") if ind_prices else None
        ind_prev = ind_prices[1].get("close") if len(ind_prices) >= 2 else None
        log_us = math.log(us_new / us_prev)
        log_fx = math.log(fx_latest / fx_prev)
        log_ind = math.log(ind_latest / ind_prev) if (ind_latest and ind_prev and ind_prev > 0) else 0.0
        gap = alpha + beta1 * log_us + beta2 * log_fx + beta3 * log_ind
        reg_pred = round(jp_close * (1 + gap), 2)

    return {
        "us_price": us_new,
        "us_is_live": us_live["is_live"],
        "fx_latest": fx_latest,
        "original": orig_pred,
        "volatility": vol_pred,
        "regression": reg_pred,
    }


async def _fetch_pts(jp_ticker: str) -> dict:
    """Scrape PTS price from kabutan.jp."""
    code = jp_ticker.replace(".T", "")
    url = f"https://kabutan.jp/stock/?code={code}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        async with httpx.AsyncClient(timeout=10, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
        match = re.search(
            r'class="kabuka1">PTS</div>\s*<div class="kabuka2">([\d,]+)円</div>\s*<div class="kabuka3">([^<]+)</div>',
            resp.text,
        )
        if match:
            return {"price": int(match.group(1).replace(",", "")), "time": match.group(2).strip()}
    except Exception:
        pass
    return {"price": None, "time": None}


@router.get("/adr-pts/{pair_id}")
async def get_adr_pts(pair_id: str):
    """Get ADR (latest US close from DB) and PTS (live kabutan scrape) for a pair."""
    sb = get_supabase()
    pair = sb.table("pairs").select("*").eq("id", pair_id).single().execute().data

    # ADR: latest 2 closes of us_ticker already stored in DB
    us_prices = _get_sorted_prices(sb, pair["us_ticker"], 2)
    adr: dict = {"price": None, "change_pct": None, "date": None}
    if us_prices:
        curr = us_prices[0]
        adr["price"] = curr.get("close")
        raw_date = curr.get("date", "")
        adr["date"] = raw_date[5:].replace("-", "/") if len(raw_date) >= 7 else raw_date
        if len(us_prices) >= 2:
            prev_close = us_prices[1].get("close")
            curr_close = us_prices[0].get("close")
            if prev_close and prev_close > 0 and curr_close:
                adr["change_pct"] = round((curr_close - prev_close) / prev_close * 100, 2)

    pts = await _fetch_pts(pair["jp_ticker"])
    return {"adr": adr, "pts": pts}


def _calc_returns(prices: list[dict]) -> list[float]:
    returns = []
    for i in range(len(prices) - 1):
        prev_close = prices[i + 1]["close"]
        curr_close = prices[i]["close"]
        if prev_close and prev_close > 0:
            returns.append((curr_close - prev_close) / prev_close)
    return returns
