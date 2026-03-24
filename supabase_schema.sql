-- StockPredict Supabase Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- pairs table
CREATE TABLE IF NOT EXISTS pairs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  us_ticker VARCHAR(20) NOT NULL,
  jp_ticker VARCHAR(20) NOT NULL,
  industry_ticker VARCHAR(20) NOT NULL DEFAULT '^GSPC',
  display_name_us VARCHAR(100) DEFAULT '',
  display_name_jp VARCHAR(100) DEFAULT '',
  display_name_industry VARCHAR(100) DEFAULT '',
  sort_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- stock_prices table
CREATE TABLE IF NOT EXISTS stock_prices (
  id BIGSERIAL PRIMARY KEY,
  ticker VARCHAR(20) NOT NULL,
  market VARCHAR(20) NOT NULL,
  date DATE NOT NULL,
  "open" NUMERIC,
  "close" NUMERIC,
  high NUMERIC,
  low NUMERIC,
  volume BIGINT,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, date)
);

-- predictions table
CREATE TABLE IF NOT EXISTS predictions (
  id BIGSERIAL PRIMARY KEY,
  pair_id UUID REFERENCES pairs(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  model_type VARCHAR(20) NOT NULL,
  predicted_open NUMERIC NOT NULL,
  actual_open NUMERIC,
  error_pct NUMERIC,
  parameters JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pair_id, target_date, model_type)
);

-- news_cache table
CREATE TABLE IF NOT EXISTS news_cache (
  id BIGSERIAL PRIMARY KEY,
  ticker VARCHAR(20) NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  source VARCHAR(100),
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(ticker, url)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_prices_ticker_date ON stock_prices(ticker, date DESC);
CREATE INDEX IF NOT EXISTS idx_predictions_pair_date ON predictions(pair_id, target_date DESC);
CREATE INDEX IF NOT EXISTS idx_news_cache_ticker ON news_cache(ticker, fetched_at DESC);

-- Updated_at trigger for pairs
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pairs_updated_at
  BEFORE UPDATE ON pairs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert default pair: SNDK / キオクシア(285A.T) / ^SOX
INSERT INTO pairs (us_ticker, jp_ticker, industry_ticker, display_name_us, display_name_jp, display_name_industry, sort_order)
VALUES ('SNDK', '285A.T', '^SOX', 'SanDisk', 'キオクシアHD', '半導体', 1)
ON CONFLICT DO NOTHING;

-- Enable Row Level Security (allow all for now - single user app)
ALTER TABLE pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE news_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on pairs" ON pairs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on stock_prices" ON stock_prices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on predictions" ON predictions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on news_cache" ON news_cache FOR ALL USING (true) WITH CHECK (true);
