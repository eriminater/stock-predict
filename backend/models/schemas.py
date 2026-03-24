from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class PairCreate(BaseModel):
    us_ticker: str
    jp_ticker: str
    industry_ticker: str
    display_name_us: str = ""
    display_name_jp: str = ""
    display_name_industry: str = ""


class PairResponse(BaseModel):
    id: str
    us_ticker: str
    jp_ticker: str
    industry_ticker: str
    display_name_us: str
    display_name_jp: str
    display_name_industry: str
    sort_order: int
    created_at: str
    updated_at: str


class PriceData(BaseModel):
    ticker: str
    market: str
    date: date
    open: Optional[float] = None
    close: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    volume: Optional[int] = None


class PredictionResponse(BaseModel):
    id: int
    pair_id: str
    target_date: date
    model_type: str
    predicted_open: float
    actual_open: Optional[float] = None
    error_pct: Optional[float] = None
    parameters: Optional[dict] = None
    created_at: str


class PredictionHistory(BaseModel):
    predictions: list[PredictionResponse]
    stats: dict


class CorrelationResponse(BaseModel):
    period_30: float
    period_60: float
    period_90: float


class NewsItem(BaseModel):
    title: str
    url: str
    published_at: str
    source: str


class ChatRequest(BaseModel):
    pair_id: str
    message: str


class ChatResponse(BaseModel):
    response: str


class IndustryRequest(BaseModel):
    us_ticker: str
    jp_ticker: str


class PairResearchRequest(BaseModel):
    us_ticker: str
    jp_ticker: str
    industry_ticker: str = ""


class FetchStatusResponse(BaseModel):
    status: str
    message: str
    fetched_at: Optional[str] = None
