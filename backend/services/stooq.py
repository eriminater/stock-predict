"""Stooq fallback data source."""

import httpx
import csv
import io
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


async def fetch_stooq_data(ticker: str, days: int = 180) -> list[dict]:
    """Fetch OHLCV data from Stooq CSV endpoint."""
    stooq_ticker = _convert_ticker(ticker)
    url = f"https://stooq.com/q/d/l/?s={stooq_ticker}&i=d"
    logger.info(f"Stooq request: {url}")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(url)
        logger.info(f"Stooq response [{stooq_ticker}]: status={resp.status_code}, body_preview={resp.text[:200]!r}")
        resp.raise_for_status()

    reader = csv.DictReader(io.StringIO(resp.text))
    rows = []
    for row in reader:
        try:
            rows.append(
                {
                    "date": row["Date"],
                    "open": float(row["Open"]),
                    "close": float(row["Close"]),
                    "high": float(row["High"]),
                    "low": float(row["Low"]),
                    "volume": int(float(row.get("Volume", 0))),
                }
            )
        except (ValueError, KeyError):
            continue

    cutoff = datetime.now().date().toordinal() - days
    rows = [r for r in rows if datetime.strptime(r["date"], "%Y-%m-%d").date().toordinal() >= cutoff]
    return rows


def _convert_ticker(ticker: str) -> str:
    """Convert Yahoo Finance ticker format to Stooq format."""
    if ticker == "USDJPY=X":
        return "usdjpy"
    if ticker.endswith(".T"):
        code = ticker.replace(".T", "")
        return f"{code}.JP"
    if ticker.startswith("^"):
        return ticker.lower()
    return ticker.lower() + ".us"
