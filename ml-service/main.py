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


def _migrate_history_is_best():
    """
    Otomatis mark is_best=True pada entry terbaik per kombinasi
    (metric, model_type, regional, witel) di training_history.json.
    Dijalankan sekali setiap startup — idempotent.
    """
    import json
    hp = config.SAVED_MODELS_DIR / "training_history.json"
    if not hp.exists():
        return
    try:
        history = json.loads(hp.read_text())
    except Exception:
        return

    # Temukan entry terbaik (smape terkecil, skill tertinggi) per kombinasi
    best_idx: dict = {}
    for i, h in enumerate(history):
        if not h.get("val_metrics") or h.get("status") == "failed":
            continue
        key = (h.get("metric"), h.get("model_type"), h.get("regional"), h.get("witel"))
        vm  = h["val_metrics"]
        score = (vm.get("smape", 999), -vm.get("skill_score", -999))
        if key not in best_idx or score < best_idx[key][1]:
            best_idx[key] = (i, score)

    best_set = {i for i, _ in best_idx.values()}
    changed = False
    for i, h in enumerate(history):
        want = (i in best_set)
        if h.get("is_best") != want:
            h["is_best"] = want
            changed = True

    if changed:
        hp.write_text(json.dumps(history, indent=2, default=str))
        logger.info(f"[STARTUP] History migrated — {len(best_set)} entries marked as is_best")


# ── Startup / Shutdown ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("BrightAI ML Service starting...")
    logger.info(f"Oracle DSN : {config.DB_DSN}")
    logger.info(f"Oracle User: {config.DB_USER}")
    logger.info(f"Models dir : {config.SAVED_MODELS_DIR}")
    _migrate_history_is_best()
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
