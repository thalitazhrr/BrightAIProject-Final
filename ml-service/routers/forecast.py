"""
routers/forecast.py
Semua endpoint FastAPI untuk forecasting.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

router = APIRouter(prefix="/forecast", tags=["Forecasting"])
logger = logging.getLogger(__name__)

# ── Pydantic schemas ──────────────────────────────────────────────────────────

MetricType = Literal[
    "order_hsi",
    "revenue_hsi",
    "churn_hsi",
    "realisasi_hsi",
    "subscriber_hsi",
    "fulfillment_rate",
    "recurring_revenue",
    "avg_install_days",
]


class TrainRequest(BaseModel):
    model_type: Literal["gru", "lstm", "tft"] = Field(
        default="gru",
        description="Jenis model: gru | lstm | tft"
    )
    metric: MetricType = Field(
        default="order_hsi",
        description="Metrik yang ingin diforecast"
    )
    regional: str = Field(
        default="NASIONAL",
        description=(
            "Regional Telkom. Gunakan 'NASIONAL' untuk agregat semua regional. "
            "Format diterima: '1'-'5', 'REG-1'-'REG-5', 'TREG1'-'TREG5'."
        )
    )
    witel: Optional[str] = Field(
        default=None,
        description=(
            "Witel (sub-regional). Isi untuk granularitas witel. "
            "Contoh: 'WITEL JATIM UTARA'. Kosongkan untuk cukup di level regional."
        )
    )
    epochs: int = Field(default=300, ge=10, le=500, description="Max epoch (early stopping akan berhenti lebih awal)")
    window_size: int = Field(default=0, ge=0, le=36, description="Window bulan historis (0 = auto-tune pilih terbaik)")


class PredictRequest(BaseModel):
    model_type: Literal["gru", "lstm", "tft"] = "gru"
    metric: MetricType = "order_hsi"
    regional: str = Field(
        default="NASIONAL",
        description="Regional Telkom ('NASIONAL', '1'-'5', 'REG-1'-'REG-5')"
    )
    witel: Optional[str] = Field(
        default=None,
        description="Witel spesifik, atau kosong untuk level regional"
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/witels")
def get_witels(
    metric: MetricType = "order_hsi",
    regional: Optional[str] = None,
):
    """Daftar witel unik dari database untuk metric + regional tertentu."""
    try:
        from data.fetcher import get_witels as _get_witels
        witels = _get_witels(metric, regional)
        return {"metric": metric, "regional": regional or "NASIONAL", "witels": witels}
    except Exception as e:
        logger.error(f"get_witels error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-preview")
def data_preview(
    metric: MetricType = "order_hsi",
    regional: Optional[str] = None,
    witel: Optional[str] = None,
    limit: int = 24,
):
    """
    Lihat data mentah dari Oracle.
    Berguna untuk memverifikasi koneksi DB dan jumlah data sebelum training.

    Regional bisa: '1', 'REG-1', 'TREG1', atau kosongkan untuk semua regional.
    """
    try:
        from data.fetcher import get_series, aggregate_national

        is_nasional = (regional is None or regional.upper() == "NASIONAL") and not witel
        reg_param   = None if is_nasional else regional

        df = get_series(metric, reg_param, witel)

        if is_nasional:
            df = aggregate_national(df)

        df = df.sort_values("periode").tail(limit)
        return {
            "metric":     metric,
            "regional":   regional or "NASIONAL",
            "witel":      witel,
            "total_rows": len(df),
            "data": [
                {
                    "periode":  str(row["periode"])[:7],
                    "regional": row["regional"],
                    "witel":    row["witel"],
                    "value":    round(float(row["value"]), 2),
                }
                for _, row in df.iterrows()
            ],
        }
    except Exception as e:
        logger.error(f"data-preview error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/train")
def train_model(req: TrainRequest, background_tasks: BackgroundTasks):
    """
    Trigger training model. Berjalan di background agar tidak timeout.
    Cek status via GET /forecast/model-status.
    """
    def _run_training():
        try:
            if req.model_type == "tft":
                from training.tft_trainer import train_tft
                result = train_tft(
                    metric=req.metric,
                    regional=req.regional,
                    witel=req.witel,
                    epochs=req.epochs,
                )
            else:
                from training.trainer import train
                result = train(
                    model_type=req.model_type,
                    metric=req.metric,
                    regional=req.regional,
                    witel=req.witel,
                    epochs=req.epochs,
                    window_size=req.window_size,
                )
            logger.info(f"Training selesai: {result}")
        except Exception as e:
            logger.error(f"Training error: {e}", exc_info=True)

    background_tasks.add_task(_run_training)

    scope = f"{req.regional}" + (f" / {req.witel}" if req.witel else "")
    return {
        "status":  "training_started",
        "message": f"Training {req.model_type.upper()} untuk {req.metric} ({scope}) dimulai di background.",
        "note":    "Gunakan GET /forecast/model-status untuk cek apakah model sudah siap.",
    }


@router.post("/predict")
def predict(req: PredictRequest):
    """
    Ambil prediksi 1 bulan kedepan menggunakan model yang sudah ditraining.
    """
    try:
        from inference.predictor import predict as _predict
        result = _predict(
            model_type=req.model_type,
            metric=req.metric,
            regional=req.regional,
            witel=req.witel,
        )
        return {"status": "success", "result": result}
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Predict error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/model-status")
def model_status():
    """
    Daftar semua model yang sudah ditraining (file .pth / .ckpt di saved_models/).
    """
    import config
    models = []

    for f in sorted(config.SAVED_MODELS_DIR.iterdir()):
        if f.suffix in (".pth", ".ckpt"):
            models.append({
                "file":     f.name,
                "size_kb":  round(f.stat().st_size / 1024, 1),
                "modified": str(f.stat().st_mtime),
            })

    return {
        "trained_models":   models,
        "total":            len(models),
        "saved_models_dir": str(config.SAVED_MODELS_DIR),
    }


@router.get("/training-history")
def training_history():
    """Riwayat semua training yang pernah dilakukan beserta KPI-nya."""
    import json
    import config
    history_path = config.SAVED_MODELS_DIR / "training_history.json"
    if not history_path.exists():
        return {"total": 0, "history": []}
    try:
        history = json.loads(history_path.read_text())
        return {"total": len(history), "history": list(reversed(history))}  # terbaru dulu
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/training-history")
def delete_training_history(trained_at: str):
    """Hapus satu entry training history berdasarkan trained_at, dan hapus model file-nya."""
    import json, config
    history_path = config.SAVED_MODELS_DIR / "training_history.json"
    if not history_path.exists():
        raise HTTPException(status_code=404, detail="History tidak ditemukan")
    try:
        history = json.loads(history_path.read_text())
        entry = next((h for h in history if h.get("trained_at") == trained_at), None)
        if not entry:
            raise HTTPException(status_code=404, detail=f"Entry '{trained_at}' tidak ditemukan")

        # Hapus model file
        model_path = Path(entry.get("model_path", ""))
        scaler_path = model_path.with_name(model_path.stem + "_scaler.pkl")
        deleted_files = []
        for f in [model_path, scaler_path]:
            if f.exists():
                f.unlink()
                deleted_files.append(f.name)

        # Hapus dari history
        history = [h for h in history if h.get("trained_at") != trained_at]
        history_path.write_text(json.dumps(history, indent=2, default=str))

        return {"status": "deleted", "trained_at": trained_at, "deleted_files": deleted_files}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/available-metrics")
def available_metrics():
    """Daftar metrik, model, dan granularitas regional yang didukung."""
    return {
        "metrics": {
            "order_hsi": {
                "desc":   "Total order HSI fulfilled bulanan",
                "source": "BRIGHTAI_SALES",
                "rules":  ["ps_001", "ps_002", "ps_011", "ps_012"],
                "model":  "gru",
                "unit":   "order",
            },
            "fulfillment_rate": {
                "desc":   "% order HSI yang berhasil dipasang per bulan",
                "source": "BRIGHTAI_SALES",
                "rules":  ["ps_006"],
                "model":  "gru",
                "unit":   "%",
            },
            "avg_install_days": {
                "desc":   "Rata-rata hari instalasi HSI per bulan",
                "source": "BRIGHTAI_SALES",
                "rules":  ["ps_007"],
                "model":  "gru",
                "unit":   "hari",
            },
            "revenue_hsi": {
                "desc":   "Total revenue HSI bulanan",
                "source": "BRIGHTAI_REVENUE",
                "rules":  ["mart_001", "mart_002"],
                "model":  "lstm",
                "unit":   "Rp",
            },
            "recurring_revenue": {
                "desc":   "Revenue recurring HSI bulanan (REV SCALING RECURRING)",
                "source": "BRIGHTAI_REVENUE",
                "rules":  ["mart_004"],
                "model":  "lstm",
                "unit":   "Rp",
            },
            "realisasi_hsi": {
                "desc":   "Realisasi HSI bulanan (SSL terpasang vs target)",
                "source": "BRIGHTAI_TARGET",
                "rules":  ["target_001", "target_003", "target_004"],
                "model":  "lstm",
                "unit":   "SSL",
            },
            "subscriber_hsi": {
                "desc":   "Total pelanggan aktif HSI bulanan",
                "source": "BRIGHTAI_DAPROS",
                "rules":  ["dapros_001", "dapros_005"],
                "model":  "tft",
                "unit":   "pelanggan",
            },
            "churn_hsi": {
                "desc":   "Total churn (CT0) HSI bulanan",
                "source": "BRIGHTAI_CT0_NAL",
                "rules":  ["ct0_001", "ct0_004", "ct0_005"],
                "model":  "gru",
                "unit":   "pelanggan",
            },
        },
        "rules_not_forecastable": {
            "reason": "Breakdown/profiling statis, bukan time series",
            "rules": [
                "ps_003 (order per bandwidth)",
                "ps_004 (penetrasi wilayah)",
                "ps_005 (coverage STO)",
                "ps_008 (revenue per bandwidth)",
                "ps_009 (channel performance)",
                "ps_010 (digital product penetration)",
                "mart_003 (customer lifecycle)",
                "mart_005 (GL account)",
                "mart_006 (service hierarchy)",
                "mart_007 (customer behavior)",
                "mart_008 (cross-geographic)",
                "target_002 (segmentation)",
                "target_005 (competitive)",
                "dapros_002 (service bundle)",
                "dapros_003 (digital transformation)",
                "dapros_004 (revenue profile)",
                "dapros_006 (speed distribution)",
                "dapros_007 (customer loyalty)",
                "ct0_002 (churn by service duration)",
                "ct0_003 (churn by bandwidth)",
                "ct0_006 (divisi churn)",
            ],
        },
        "models": {
            "gru":  "GRU — volatile/fluktuatif: order, churn, fulfillment, install time",
            "lstm": "LSTM — smooth/tren panjang: revenue, recurring revenue, realisasi",
            "tft":  "TFT — multi-regional + covariates: subscriber aktif",
        },
        "regional_options": {
            "NASIONAL": "Agregat semua regional (default)",
            "1 / REG-1 / TREG1": "Regional 1 (semua format diterima, dikonversi otomatis)",
            "2 / REG-2 / TREG2": "Regional 2",
            "3 / REG-3 / TREG3": "Regional 3",
            "4 / REG-4 / TREG4": "Regional 4",
            "5 / REG-5 / TREG5": "Regional 5",
        },
        "witel_options": (
            "Isi field 'witel' dengan nama witel spesifik untuk granularitas lebih dalam. "
            "Kosongkan untuk level regional saja."
        ),
    }
