"""Yahoo Finance v8 direct HTTP client (primary data source)."""

import httpx
import time
from datetime import datetime, timedelta

BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


async def fetch_chart_data(
    ticker: str,
    period1: datetime | None = None,
    period2: datetime | None = None,
    interval: str = "1d",
    range_str: str = "6mo",
) -> list[dict]:
    """Fetch OHLCV data from Yahoo Finance v8 chart API."""
    params: dict = {"interval": interval}
    if period1 and period2:
        params["period1"] = int(period1.timestamp())
        params["period2"] = int(period2.timestamp())
    else:
        params["range"] = range_str

    url = f"{BASE_URL}/{ticker}"

    async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    result_block = data["chart"]["result"][0]
    timestamps = result_block["timestamp"]
    quote = result_block["indicators"]["quote"][0]

    rows = []
    for i, ts in enumerate(timestamps):
        dt = datetime.utcfromtimestamp(ts).date()
        rows.append(
            {
                "date": dt.isoformat(),
                "open": _round(quote["open"][i]),
                "close": _round(quote["close"][i]),
                "high": _round(quote["high"][i]),
                "low": _round(quote["low"][i]),
                "volume": quote["volume"][i],
            }
        )
    return rows


def _round(v):
    if v is None:
        return None
    return round(v, 4)
