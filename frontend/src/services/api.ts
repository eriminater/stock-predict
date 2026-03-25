import axios from 'axios';
import type { Pair, Prediction, Correlation, NewsItem, AdrPts, LivePrediction } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || '';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

// Pairs
export const getPairs = () => api.get<Pair[]>('/api/pairs').then(r => r.data);
export const createPair = (data: {
  us_ticker: string;
  jp_ticker: string;
  industry_ticker: string;
  display_name_us?: string;
  display_name_jp?: string;
  display_name_industry?: string;
}) => api.post<Pair>('/api/pairs', data).then(r => r.data);
export const deletePair = (id: string) => api.delete(`/api/pairs/${id}`);
export const refreshPairNames = (id: string) =>
  api.post(`/api/pairs/${id}/refresh-names`).then(r => r.data);
export const initializePair = (id: string) =>
  api.post(`/api/pairs/${id}/initialize`, {}, { timeout: 300000 }).then(r => r.data);

// Data
export const fetchAllData = () => api.post('/api/data/fetch', {}, { timeout: 300000 }).then(r => r.data);
export const fetchPairData = (id: string) => api.post(`/api/data/fetch/${id}`, {}, { timeout: 120000 }).then(r => r.data);
export const getPrices = (ticker: string, days = 30) =>
  api.get(`/api/data/prices/${ticker}`, { params: { days } }).then(r => r.data);
export const validateTicker = (ticker: string) =>
  api.get<{ valid: boolean }>(`/api/data/validate/${ticker}`).then(r => r.data.valid);

// Predictions
export const getPredictions = (pairId: string) =>
  api.get<Prediction[]>(`/api/predictions/${pairId}`).then(r => r.data);
export const getPredictionHistory = (pairId: string, days = 30) =>
  api.get(`/api/predictions/${pairId}/history`, { params: { days } }).then(r => r.data);
export const calculatePredictions = () => api.post('/api/predictions/calculate', {}, { timeout: 120000 }).then(r => r.data);
export const backfillPredictions = () => api.post('/api/predictions/backfill', {}, { timeout: 120000 }).then(r => r.data);

// Analysis
export const getCorrelation = (pairId: string) =>
  api.get<Correlation>(`/api/analysis/correlation/${pairId}`).then(r => r.data);
export const getLivePrediction = (pairId: string) =>
  api.get<LivePrediction>(`/api/analysis/live-prediction/${pairId}`).then(r => r.data);
export const getAdrPts = (pairId: string) =>
  api.get<AdrPts>(`/api/analysis/adr-pts/${pairId}`).then(r => r.data);
export const getReturns = (pairId: string, days = 30) =>
  api.get(`/api/analysis/returns/${pairId}`, { params: { days } }).then(r => r.data);
export const pairResearch = (data: { us_ticker: string; jp_ticker: string; industry_ticker?: string }) =>
  api.post('/api/analysis/pair-research', data).then(r => r.data);

// News
export const getNews = (ticker: string, limit = 5) =>
  api.get<NewsItem[]>(`/api/news/${ticker}`, { params: { limit } }).then(r => r.data);

// AI
export const aiChat = (pairId: string, message: string) =>
  api.post('/api/ai/chat', { pair_id: pairId, message }).then(r => r.data);
export const suggestIndustry = (us: string, jp: string) =>
  api.post('/api/ai/suggest-industry', { us_ticker: us, jp_ticker: jp }).then(r => r.data);
export const suggestPairs = () => api.post('/api/ai/suggest-pairs').then(r => r.data);
export const getQuotaStatus = () => api.get('/api/ai/quota-status').then(r => r.data);
export const setPreferredModel = (model: string) => api.post('/api/ai/set-model', { model }).then(r => r.data);
