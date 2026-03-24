"""News endpoints."""

from fastapi import APIRouter
from db.supabase_client import get_supabase
from services.google_rss import fetch_news
from datetime import datetime

router = APIRouter(prefix="/api/news", tags=["news"])


@router.get("/{ticker}")
async def get_news(ticker: str, limit: int = 5):
    """Get news for a ticker. Checks cache first, fetches if stale."""
    sb = get_supabase()

    # Check cache (within last 6 hours)
    cached = (
        sb.table("news_cache")
        .select("*")
        .eq("ticker", ticker)
        .order("fetched_at", desc=True)
        .limit(limit)
        .execute()
    )

    if cached.data:
        latest_fetch = cached.data[0].get("fetched_at", "")
        if latest_fetch:
            try:
                fetched_time = datetime.fromisoformat(latest_fetch.replace("Z", "+00:00"))
                age_hours = (datetime.now(fetched_time.tzinfo) - fetched_time).total_seconds() / 3600
                if age_hours < 6:
                    return cached.data[:limit]
            except Exception:
                pass

    # Fetch fresh news
    search_query = ticker.replace(".T", "").replace("^", "")
    items = await fetch_news(f"{search_query} 株価", max_items=limit)

    # Save to cache
    for item in items:
        sb.table("news_cache").upsert(
            {
                "ticker": ticker,
                "title": item["title"],
                "url": item["url"],
                "published_at": item["published_at"],
                "source": item["source"],
                "fetched_at": datetime.utcnow().isoformat(),
            },
            on_conflict="ticker,url",
        ).execute()

    return items
