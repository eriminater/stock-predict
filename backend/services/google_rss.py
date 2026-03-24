"""Google RSS news fetcher."""

import feedparser
import httpx
from urllib.parse import quote


async def fetch_news(query: str, max_items: int = 5) -> list[dict]:
    """Fetch news from Google RSS feed."""
    encoded = quote(query)
    url = f"https://news.google.com/rss/search?q={encoded}&hl=ja&gl=JP&ceid=JP:ja"

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    feed = feedparser.parse(resp.text)
    items = []
    for entry in feed.entries[:max_items]:
        items.append({
            "title": entry.get("title", ""),
            "url": entry.get("link", ""),
            "published_at": entry.get("published", ""),
            "source": entry.get("source", {}).get("title", "Google News"),
        })
    return items
