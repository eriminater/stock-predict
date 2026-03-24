"""AI endpoints: chat, industry suggestion, pair suggestion."""

from fastapi import APIRouter
from db.supabase_client import get_supabase
from services.gemini import chat_with_context, suggest_industry, suggest_pairs, get_quota_status, set_preferred_model
from models.schemas import ChatRequest, ChatResponse, IndustryRequest

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/chat", response_model=ChatResponse)
async def ai_chat(req: ChatRequest):
    """AI analyst chat with auto context."""
    sb = get_supabase()
    pair = sb.table("pairs").select("*").eq("id", req.pair_id).single().execute().data

    # Build context from latest data
    us_prices = (
        sb.table("stock_prices")
        .select("close,date")
        .eq("ticker", pair["us_ticker"])
        .order("date", desc=True)
        .limit(5)
        .execute()
        .data
    )
    jp_prices = (
        sb.table("stock_prices")
        .select("close,date")
        .eq("ticker", pair["jp_ticker"])
        .order("date", desc=True)
        .limit(5)
        .execute()
        .data
    )
    fx_prices = (
        sb.table("stock_prices")
        .select("close,date")
        .eq("ticker", "USDJPY=X")
        .order("date", desc=True)
        .limit(2)
        .execute()
        .data
    )
    predictions = (
        sb.table("predictions")
        .select("*")
        .eq("pair_id", req.pair_id)
        .order("target_date", desc=True)
        .limit(3)
        .execute()
        .data
    )

    context = f"""
ペア: {pair['us_ticker']} / {pair['jp_ticker']} ({pair.get('display_name_us','')} / {pair.get('display_name_jp','')})
米国株直近5日終値: {us_prices}
日本株直近5日終値: {jp_prices}
為替(USD/JPY): {fx_prices}
最新予測: {predictions}
"""
    response = await chat_with_context(req.message, context)
    return ChatResponse(response=response)


@router.post("/suggest-industry")
async def ai_suggest_industry(req: IndustryRequest):
    """Suggest industry indices for a pair."""
    suggestions = await suggest_industry(req.us_ticker, req.jp_ticker)
    return suggestions


@router.post("/suggest-pairs")
async def ai_suggest_pairs():
    """Suggest stock pairs using AI."""
    suggestions = await suggest_pairs()
    return suggestions


@router.get("/quota-status")
async def ai_quota_status():
    """Return today's Gemini API usage (in-memory, resets on server restart)."""
    return get_quota_status()


@router.post("/set-model")
async def ai_set_model(req: dict):
    """Set preferred Gemini model."""
    model = req.get("model", "gemini-2.0-flash-lite")
    result = set_preferred_model(model)
    return {"preferred_model": result}
