"""yfinance library fallback (3rd priority)."""

import yfinance as yf
from datetime import datetime, timedelta


def fetch_ticker_name(ticker: str) -> str:
    """Fetch company short name from yfinance info."""
    try:
        t = yf.Ticker(ticker)
        info = t.info
        return info.get("shortName") or info.get("longName") or ""
    except Exception:
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
