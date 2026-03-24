"""yfinance library fallback (3rd priority)."""

import re
import httpx
import yfinance as yf
from datetime import datetime, timedelta


def fetch_ticker_name(ticker: str) -> str:
    """Fetch company name via Yahoo Finance v8 chart meta (sync httpx)."""
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d"
    try:
        with httpx.Client(timeout=10, headers=headers) as c:
            r = c.get(url)
            data = r.json()
            meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
            return meta.get("shortName") or meta.get("longName") or ""
    except Exception:
        return ""


async def fetch_jp_name_from_kabutan(jp_ticker: str) -> str:
    """Fetch Japanese company name from kabutan.jp (for .T tickers)."""
    if not jp_ticker.endswith(".T"):
        return ""
    code = jp_ticker.replace(".T", "")
    url = f"https://kabutan.jp/stock/?code={code}"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        async with httpx.AsyncClient(timeout=10, headers=headers, follow_redirects=True) as client:
            resp = await client.get(url)
        # Title format: "フジクラ（5803）の株価..."
        match = re.search(r'<title>([^（\(]+?)(?:【|（|\()', resp.text)
        if match:
            return match.group(1).strip()
    except Exception:
        pass
    return ""


def fetch_yfinance_data(ticker: str, days: int = 180) -> list[dict]:
    """Fetch OHLCV data using yfinance library."""
    end = datetime.now()
    start = end - timedelta(days=days)
    t = yf.Ticker(ticker)
    df = t.history(start=start.strftime("%Y-%m-%d"), end=end.strftime("%Y-%m-%d"))
    rows = []
    for idx, row in df.iterrows():
        rows.append({
            "date": idx.strftime("%Y-%m-%d"),
            "open": round(row["Open"], 4),
            "close": round(row["Close"], 4),
            "high": round(row["High"], 4),
            "low": round(row["Low"], 4),
            "volume": int(row["Volume"]),
        })
    return rows
