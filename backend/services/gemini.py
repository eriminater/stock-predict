"""Gemini integration for AI analyst and industry suggestion."""

import os
import json
import asyncio
from datetime import datetime, timezone, timedelta
from google import genai

# ---------------------------------------------------------------------------
# In-memory quota tracker (resets at midnight PT = 17:00 JST)
# ---------------------------------------------------------------------------
_PT  = timezone(timedelta(hours=-8))  # PST (Gemini quota reset基準)
_JST = timezone(timedelta(hours=9))   # 表示用

_quota: dict = {
    "date": None,       # current PT date string (reset判定用)
    "calls": 0,         # total Gemini API calls today
    "errors_429": 0,    # quota errors today
    "last_model": None, # last model used
    "last_call_at": None,
}

# Free-tier daily limits per model (RPD) - 2.5系
MODEL_RPD = {
    "gemini-2.5-flash-lite": 1000,
    "gemini-2.5-flash": 250,
}

FALLBACK_MODELS = list(MODEL_RPD.keys())

# User-selected preferred model (default: 2.5-flash-lite)
_preferred_model: str = "gemini-2.5-flash-lite"


def set_preferred_model(model: str) -> str:
    global _preferred_model
    if model in MODEL_RPD:
        _preferred_model = model
    return _preferred_model


def _today_pt() -> str:
    return datetime.now(_PT).strftime("%Y-%m-%d")


def _reset_if_new_day():
    today = _today_pt()
    if _quota["date"] != today:
        _quota["date"] = today
        _quota["calls"] = 0
        _quota["errors_429"] = 0
        _quota["last_model"] = None


def get_quota_status() -> dict:
    _reset_if_new_day()
    return {
        "date_jst": datetime.now(_JST).strftime("%Y-%m-%d"),
        "calls_today": _quota["calls"],
        "errors_429_today": _quota["errors_429"],
        "last_model": _quota["last_model"],
        "last_call_at": _quota["last_call_at"],
        "limits": MODEL_RPD,
        "preferred_model": _preferred_model,
        "estimated_remaining": max(0, MODEL_RPD[_preferred_model] - _quota["calls"]),
    }


def _get_client():
    return genai.Client(api_key=os.environ.get("GEMINI_API_KEY", ""))


def _generate(prompt: str) -> str:
    _reset_if_new_day()
    client = _get_client()
    # Try preferred model first, then remaining fallbacks
    order = [_preferred_model] + [m for m in FALLBACK_MODELS if m != _preferred_model]
    for model in order:
        try:
            response = client.models.generate_content(model=model, contents=prompt)
            _quota["calls"] += 1
            _quota["last_model"] = model
            _quota["last_call_at"] = datetime.now(_JST).strftime("%Y-%m-%d %H:%M JST")
            return response.text
        except Exception as e:
            err = str(e)
            if "429" in err or "RESOURCE_EXHAUSTED" in err:
                _quota["errors_429"] += 1
                continue
            if "404" in err or "NOT_FOUND" in err:
                continue  # モデル非対応 → 次のモデルへ
            raise
    raise RuntimeError("全モデルのクォータが上限に達しています。17:00 JST以降に再度お試しください。")


async def chat_with_context(message: str, context: str) -> str:
    """Send a message to Gemini with stock data context."""
    prompt = f"""あなたは株式アナリストのAIアシスタントです。以下のデータを参考に、ユーザーの質問に日本語で回答してください。

## 参考データ
{context}

## ユーザーの質問
{message}
"""
    return await asyncio.to_thread(_generate, prompt)


async def suggest_industry(us_ticker: str, jp_ticker: str) -> list[dict]:
    """Use Gemini to suggest relevant industry indices."""
    prompt = f"""米国株 {us_ticker} と日本株 {jp_ticker} のペアに関連する業界指数を3つ提案してください。
JSON配列で返してください。各要素は {{"ticker": "^SOX", "name": "PHLX半導体指数"}} の形式です。
JSONのみ返してください。"""
    text = await asyncio.to_thread(_generate, prompt)
    try:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text)
    except Exception:
        return [{"ticker": "^GSPC", "name": "S&P 500"}]


async def suggest_pairs() -> list[dict]:
    """Use Gemini to suggest stock pairs."""
    prompt = """連動性が高いと推測される米国株と日本株のペアを20組提案してください。半導体・テクノロジー・金融・製造業など多様なセクターを含めてください。
JSON配列で返してください。各要素は {{"us_ticker": "NVDA", "jp_ticker": "6857.T", "jp_name": "アドバンテスト", "reason": "半導体テスト装置"}} の形式です。
JSONのみ返してください。"""
    text = await asyncio.to_thread(_generate, prompt)
    try:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(text)
    except Exception:
        return []
