export interface Pair {
  id: string;
  us_ticker: string;
  jp_ticker: string;
  industry_ticker: string;
  display_name_us: string;
  display_name_jp: string;
  display_name_industry: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Prediction {
  id: number;
  pair_id: string;
  target_date: string;
  model_type: 'original' | 'volatility' | 'regression';
  predicted_open: number;
  actual_open: number | null;
  error_pct: number | null;
  parameters: Record<string, unknown>;
  created_at: string;
}

export interface PredictionStats {
  avg_error: number | null;
  hit_rate: string;
  max_error: number | null;
}

export interface PriceData {
  id: number;
  ticker: string;
  market: string;
  date: string;
  open: number | null;
  close: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
}

export interface NewsItem {
  title: string;
  url: string;
  published_at: string;
  source: string;
}

export interface Correlation {
  period_30: number;
  period_60: number;
  period_90: number;
}

export interface LivePrediction {
  us_price: number;
  us_is_live: boolean;
  fx_latest: number;
  original: number | null;
  volatility: number | null;
  regression: number | null;
}

export interface AdrPts {
  adr: { price: number | null; change_pct: number | null; date: string | null };
  pts: { price: number | null; time: string | null };
}

export interface PresetPair {
  us_ticker: string;
  jp_ticker: string;
  jp_name: string;
}
