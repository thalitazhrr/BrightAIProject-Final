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
    "fulfillment_rate",
    "recurring_revenue",
    "avg_install_days",
]


class TrainRequest(BaseModel):
    model_type: Literal["gru", "lstm", "tft", "prophet", "arima"] = Field(
        default="gru",
        description="Jenis model: gru | lstm | tft | prophet | arima"
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
    model_type: Literal["gru", "lstm", "tft", "prophet", "arima"] = "gru"
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
                raise RuntimeError("TFT tidak tersedia (pytorch_lightning tidak terinstall). Gunakan GRU, LSTM, atau Prophet.")
            elif req.model_type == "prophet":
                from training.prophet_trainer import train_prophet
                result = train_prophet(
                    metric=req.metric,
                    regional=req.regional,
                    witel=req.witel,
                )
            elif req.model_type == "arima":
                from training.arima_trainer import train_arima
                result = train_arima(
                    metric=req.metric,
                    regional=req.regional,
                    witel=req.witel,
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
            # Catat kegagalan ke history agar terlihat di UI
            import json, config as _cfg
            from datetime import datetime
            from data.fetcher import regional_display
            _hp = _cfg.SAVED_MODELS_DIR / "training_history.json"
            _hist = []
            if _hp.exists():
                try: _hist = json.loads(_hp.read_text())
                except Exception: pass
            _hist.append({
                "status":     "failed",
                "model_type": req.model_type,
                "metric":     req.metric,
                "regional":   regional_display(req.regional),
                "witel":      req.witel,
                "error":      str(e),
                "trained_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            })
            _hp.write_text(json.dumps(_hist, indent=2, default=str))

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


@router.get("/compare-models")
def compare_models(
    metric: MetricType = "order_hsi",
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
):
    """
    Bandingkan semua model yang sudah ditraining untuk metric+regional yang sama.

    Mengembalikan:
    - Ranking semua model berdasarkan sMAPE walk-forward (metodologi TA yang benar)
    - Skill score GRU/LSTM vs baseline terbaik (ARIMA atau Prophet)
    - Rekomendasi model: apakah deep learning justified atau baseline sudah cukup
    """
    import json, config as _cfg
    from datetime import datetime
    from data.fetcher import regional_display as _reg_display

    reg = _reg_display(regional)
    history_path = _cfg.SAVED_MODELS_DIR / "training_history.json"
    if not history_path.exists():
        return {"metric": metric, "regional": reg, "witel": witel, "models": [], "recommendation": None}

    try:
        all_history = json.loads(history_path.read_text())
    except Exception:
        return {"metric": metric, "regional": reg, "witel": witel, "models": [], "recommendation": None}

    # Filter: metric + regional + witel + success + is_best=True per model_type
    relevant = [
        h for h in all_history
        if h.get("metric") == metric
        and h.get("regional") == reg
        and (h.get("witel") or None) == (witel or None)
        and h.get("status") == "success"
        and h.get("val_metrics")
        and h.get("is_best") is True
    ]

    # Ambil entry terbaik per model_type (by sMAPE)
    best_per_type = {}
    for h in relevant:
        mt = h["model_type"]
        smape = h["val_metrics"].get("smape", 999)
        if mt not in best_per_type or smape < best_per_type[mt]["val_metrics"].get("smape", 999):
            best_per_type[mt] = h

    if not best_per_type:
        return {
            "metric": metric, "regional": reg, "witel": witel,
            "models": [], "recommendation": None,
            "note": "Belum ada model yang ditraining untuk kombinasi ini."
        }

    # Baseline terbaik: min sMAPE di antara arima dan prophet
    baseline_types = ["arima", "prophet"]
    main_types     = ["gru", "lstm"]
    baselines = {k: v for k, v in best_per_type.items() if k in baseline_types}
    mains     = {k: v for k, v in best_per_type.items() if k in main_types}

    best_baseline_entry = None
    if baselines:
        best_baseline_entry = min(baselines.values(), key=lambda h: h["val_metrics"].get("smape", 999))

    # Hitung cross-model skill score untuk main models vs best baseline
    # skill_vs_baseline = 1 - MAE_model / MAE_best_baseline (metodologi TA yang benar)
    def cross_skill(model_entry, baseline_entry):
        if baseline_entry is None:
            return None
        mae_model    = model_entry["val_metrics"].get("mae", None)
        mae_baseline = baseline_entry["val_metrics"].get("mae", None)
        if mae_model is None or mae_baseline is None or mae_baseline < 1e-4:
            return None
        return round(1.0 - mae_model / mae_baseline, 4)

    # Susun tabel semua model
    model_rows = []
    for model_type, entry in best_per_type.items():
        vm = entry["val_metrics"]
        kpi = vm.get("kpi", {})
        is_baseline = model_type in baseline_types
        is_main     = model_type in main_types

        skill_vs_baseline = None
        baseline_ref_type = None
        if is_main and best_baseline_entry:
            skill_vs_baseline = cross_skill(entry, best_baseline_entry)
            baseline_ref_type = best_baseline_entry["model_type"]

        model_rows.append({
            "model_type":          model_type,
            "category":            "baseline" if is_baseline else "main",
            "smape":               round(vm.get("smape", 999), 2),
            "mae":                 round(vm.get("mae", 0), 2),
            "mase":                round(vm.get("mase", 999), 4),
            "skill_score_vs_naive":round(vm.get("skill_score", 0), 4),   # vs seasonal naive
            "skill_vs_best_baseline": skill_vs_baseline,                 # vs ARIMA/Prophet (untuk TA)
            "baseline_ref":        baseline_ref_type,
            "kpi_pass":            vm.get("smape", 999) < 30.0 and vm.get("skill_score", -999) > -0.1,
            "trained_at":          entry.get("trained_at"),
            "arima_meta":          entry.get("arima_meta"),              # order, seasonal_order, AIC
            "data_points":         entry.get("data_points"),
            "n_test":              entry.get("n_test"),
        })

    # Ranking berdasarkan sMAPE (ascending)
    model_rows.sort(key=lambda r: r["smape"])
    for i, row in enumerate(model_rows):
        row["rank"] = i + 1

    winner = model_rows[0]["model_type"] if model_rows else None

    # Rekomendasi untuk Tugas Akhir
    recommendation = None
    if winner and best_baseline_entry:
        winner_entry  = best_per_type[winner]
        winner_smape  = winner_entry["val_metrics"].get("smape", 999)
        baseline_smape= best_baseline_entry["val_metrics"].get("smape", 999)

        if winner in baseline_types:
            recommendation = {
                "winner":  winner.upper(),
                "verdict": "baseline_sufficient",
                "message": (
                    f"Model baseline {winner.upper()} adalah yang terbaik (sMAPE {winner_smape:.1f}%). "
                    f"Deep learning (GRU/LSTM) tidak memberikan nilai tambah signifikan untuk data ini. "
                    f"Untuk Tugas Akhir: model statistik sederhana sudah cukup — ini adalah temuan yang valid."
                ),
                "use_deep_learning": False,
            }
        else:
            skill = cross_skill(winner_entry, best_baseline_entry)
            if skill is not None and skill > 0.05:
                recommendation = {
                    "winner":  winner.upper(),
                    "verdict": "deep_learning_justified",
                    "message": (
                        f"{winner.upper()} adalah model terbaik (sMAPE {winner_smape:.1f}%) dengan "
                        f"skill score {skill*100:.1f}% lebih akurat dari baseline terbaik "
                        f"({best_baseline_entry['model_type'].upper()}, sMAPE {baseline_smape:.1f}%). "
                        f"Deep learning terjustifikasi secara empiris."
                    ),
                    "use_deep_learning": True,
                    "skill_vs_baseline": skill,
                }
            else:
                recommendation = {
                    "winner":  winner.upper(),
                    "verdict": "marginal_improvement",
                    "message": (
                        f"{winner.upper()} sedikit lebih baik (sMAPE {winner_smape:.1f}% vs baseline {baseline_smape:.1f}%), "
                        f"namun perbedaannya kecil. Pertimbangkan baseline untuk kesederhanaan interpretasi."
                    ),
                    "use_deep_learning": True,
                    "skill_vs_baseline": skill,
                }
    elif winner:
        recommendation = {
            "winner":  winner.upper(),
            "verdict": "no_baseline_trained",
            "message": f"{winner.upper()} adalah model terbaik yang sudah ditraining. Train Prophet dan ARIMA untuk perbandingan lengkap.",
            "use_deep_learning": winner in main_types,
        }

    return {
        "metric":          metric,
        "regional":        reg,
        "witel":           witel,
        "compared_at":     datetime.now().isoformat(),
        "models_compared": len(model_rows),
        "models":          model_rows,
        "winner":          winner,
        "best_baseline":   best_baseline_entry["model_type"] if best_baseline_entry else None,
        "recommendation":  recommendation,
    }


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
            "gru":     "GRU — model utama: volatile/fluktuatif (order, churn, fulfillment, install time)",
            "lstm":    "LSTM — model utama: smooth/tren panjang (revenue, recurring revenue, realisasi)",
            "prophet": "Prophet — baseline 1: trend + seasonal + holiday Indonesia (Idul Fitri, Idul Adha)",
            "arima":   "ARIMA/SARIMA — baseline 2: autokorelasi temporal + seasonal differencing (auto parameter selection)",
            "tft":     "TFT — tidak tersedia (pytorch_lightning tidak terinstall)",
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
