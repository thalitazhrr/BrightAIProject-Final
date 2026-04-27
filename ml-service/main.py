"""
main.py
Entry point FastAPI — BrightAI ML Service.
Jalankan: uvicorn main:app --reload --port 8000
"""
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.forecast import router as forecast_router
import config

# ── Env ───────────────────────────────────────────────────────────────────────
import os
_DEV = os.getenv("APP_ENV", "development") == "development"

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger(__name__)


# ── Startup / Shutdown ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("BrightAI ML Service starting...")
    logger.info(f"Oracle DSN : {config.DB_DSN}")
    logger.info(f"Oracle User: {config.DB_USER}")
    logger.info(f"Models dir : {config.SAVED_MODELS_DIR}")
    yield
    logger.info("BrightAI ML Service stopped.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="BrightAI ML Service",
    description="Time Series Forecasting (GRU / LSTM / TFT) untuk data HSI Telkom",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _DEV else None,     # nonaktif di production
    redoc_url="/redoc" if _DEV else None,
)

# CORS — hanya izinkan backend Node.js (localhost:3001)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001", "http://127.0.0.1:3001"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ── Routes ────────────────────────────────────────────────────────────────────
app.include_router(forecast_router)


@app.get("/health")
def health():
    return {
        "status":  "ok",
        "service": "BrightAI ML Service",
        "version": "1.0.0",
    }


@app.get("/")
def root():
    return {
        "message": "BrightAI ML Service",
        "docs":    "http://localhost:8000/docs",
        "endpoints": {
            "health":            "GET  /health",
            "data_preview":      "GET  /forecast/data-preview",
            "available_metrics": "GET  /forecast/available-metrics",
            "model_status":      "GET  /forecast/model-status",
            "train":             "POST /forecast/train",
            "predict":           "POST /forecast/predict",
        },
    }
