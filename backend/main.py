"""StockPredict FastAPI Backend."""

import os
import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers import pairs, data, predictions, analysis, news, ai
from jobs.scheduler import setup_scheduler

load_dotenv()
logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch scheduler
    scheduler = setup_scheduler()
    scheduler.start()
    logging.info("Scheduler started")
    yield
    # Shutdown
    scheduler.shutdown()


app = FastAPI(
    title="StockPredict API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
allowed_origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "https://stock-predict-eid.pages.dev",
]
# Add Cloudflare Pages domain if set
cf_domain = os.environ.get("FRONTEND_URL", "")
if cf_domain:
    # Strip trailing slash
    allowed_origins.append(cf_domain.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(pairs.router)
app.include_router(data.router)
app.include_router(predictions.router)
app.include_router(analysis.router)
app.include_router(news.router)
app.include_router(ai.router)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


@app.get("/")
async def root():
    return {"status": "ok", "service": "StockPredict API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
