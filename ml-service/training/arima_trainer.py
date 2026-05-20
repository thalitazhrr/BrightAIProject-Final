"""
training/arima_trainer.py
Training SARIMA (Seasonal ARIMA) sebagai baseline model ke-2.

auto_arima dari pmdarima otomatis memilih parameter (p,d,q)(P,D,Q)m terbaik
berdasarkan AIC — tidak perlu tuning manual.

Untuk data bulanan telekomunikasi:
  - m = 12 (seasonality tahunan)
  - seasonal=True jika data >= 24 bulan, False jika lebih pendek
  - Walk-forward validation (sama seperti Prophet dan GRU/LSTM)
"""
from __future__ import annotations

import json
import logging
import pickle
import warnings
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

import config
from data.fetcher import get_series, aggregate_national, regional_display
from utils.metrics import all_metrics

logger = logging.getLogger(__name__)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _model_tag(metric: str, regional: str, witel: Optional[str]) -> str:
    reg_part = regional.lower().replace("-", "").replace(" ", "_")
    tag = f"arima_{metric}_{reg_part}"
    if witel:
        tag += f"_{witel.lower().replace(' ', '_')}"
    return tag


def _model_path(metric: str, regional: str, witel: Optional[str] = None) -> Path:
    return config.SAVED_MODELS_DIR / f"{_model_tag(metric, regional, witel)}.pkl"


def _fit_arima(y: np.ndarray, seasonal: bool):
    """
    Fit auto_arima pada array y.
    Mengembalikan model pmdarima yang sudah di-fit.
    """
    import pmdarima as pm
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        model = pm.auto_arima(
            y,
            seasonal=seasonal,
            m=12,
            start_p=0, start_q=0, max_p=3, max_q=3,
            start_P=0, start_Q=0, max_P=1, max_Q=1,
            d=None, D=None,                     # auto-detect differencing
            seasonal_test="ch",                 # Canova-Hansen, lebih robust untuk series pendek vs OCSB default
            information_criterion="aic",
            stepwise=True,                       # jauh lebih cepat dari grid search
            suppress_warnings=True,
            error_action="ignore",
        )
    return model


def _predict_one(model, alpha: float = 0.10) -> tuple[float, float, float]:
    """Prediksi 1 langkah ke depan beserta confidence interval."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        preds, conf = model.predict(n_periods=1, return_conf_int=True, alpha=alpha)
    yhat  = max(0.0, float(preds[0]))
    lower = max(0.0, float(conf[0][0]))
    upper = float(conf[0][1])
    return yhat, lower, upper


# ── Entry point ───────────────────────────────────────────────────────────────

def train_arima(
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
) -> dict:
    """
    Latih SARIMA dengan auto_arima + walk-forward validation → simpan model .pkl.
    Output format identik dengan prophet_trainer dan trainer (GRU/LSTM).
    """
    try:
        import pmdarima as pm  # noqa: F401
    except ImportError:
        raise RuntimeError("pmdarima tidak terinstall. Jalankan: pip install pmdarima")

    reg_display = regional_display(regional)
    log_scope   = reg_display + (f" / {witel}" if witel else "")
    logger.info(f"[ARIMA] Training | {metric} | {log_scope}")

    is_nasional = regional.upper() == "NASIONAL" and not witel
    reg_param   = None if is_nasional else regional

    # ── 1. Ambil data ──────────────────────────────────────────────────────────
    df = get_series(metric, reg_param, witel)
    if is_nasional:
        df = aggregate_national(df)

    df     = df.sort_values("periode")
    n_data = len(df)
    logger.info(f"[ARIMA] {n_data} bulan data tersedia")

    if n_data < 6:
        raise ValueError(f"Data terlalu sedikit untuk ARIMA: {n_data} baris (butuh min 6)")

    y_all   = df["value"].values.astype(float)
    # Gunakan SARIMA hanya jika data cukup untuk seasonal differencing (min 2 siklus = 24 bln)
    use_seasonal = (n_data >= 24)
    logger.info(f"[ARIMA] Mode: {'SARIMA(m=12)' if use_seasonal else 'ARIMA (non-seasonal)'}")

    # Deteksi partial data — exclude bulan terakhir dari walk-forward eval jika belum selesai
    median_raw = float(np.median(y_all[:-1])) if len(y_all) > 1 else y_all[-1]
    is_partial = median_raw > 0 and y_all[-1] < median_raw * 0.30
    if is_partial:
        logger.warning(f"[ARIMA] Partial data terdeteksi (last={y_all[-1]:.0f} vs median={median_raw:.0f}) — exclude dari walk-forward eval")
        y_eval = y_all[:-1]
        n_eval = n_data - 1
    else:
        y_eval = y_all
        n_eval = n_data

    # ── 2. Walk-forward evaluation ─────────────────────────────────────────────
    n_test = max(3, min(6, n_eval // 7))
    logger.info(f"[ARIMA] Walk-forward: {n_test} langkah")

    preds, actuals = [], []
    for i in range(n_test):
        train_end = n_eval - n_test + i
        if train_end < 6:
            continue
        train_y = y_eval[:train_end]
        model   = _fit_arima(train_y, seasonal=use_seasonal)
        yhat, _, _ = _predict_one(model)
        preds.append(yhat)
        actuals.append(float(y_eval[train_end]))
        logger.info(f"[ARIMA]   step {i+1}/{n_test} order={model.order} seasonal={model.seasonal_order} → {yhat:.2f} (actual={y_eval[train_end]:.2f})")

    preds_arr   = np.array(preds, dtype=np.float32)
    actuals_arr = np.array(actuals, dtype=np.float32)

    metrics = all_metrics(actuals_arr, preds_arr, y_train=y_eval.astype(np.float32), m=12)
    logger.info(f"[ARIMA] Metrics: {metrics}")

    kpi = metrics.get("kpi", {})
    logger.info(
        f"[ARIMA] KPI — MASE<1: {kpi.get('mase_ok','?')} | "
        f"sMAPE<30%: {kpi.get('smape_short_ok','?')} | "
        f"Skill>-0.1: {kpi.get('skill_ok','?')}"
    )

    # ── 3. Final model pada semua data ─────────────────────────────────────────
    logger.info(f"[ARIMA] Training final model ({n_data} bulan) ...")
    final_model = _fit_arima(y_all, seasonal=use_seasonal)
    logger.info(f"[ARIMA] Final order={final_model.order} seasonal={final_model.seasonal_order}")

    # ── 4. Benchmark vs history ────────────────────────────────────────────────
    model_path   = _model_path(metric, reg_display, witel)
    history_path = config.SAVED_MODELS_DIR / "training_history.json"
    _hist_all    = []
    if history_path.exists():
        try:
            _hist_all = json.loads(history_path.read_text())
        except Exception:
            _hist_all = []

    def _score(entry):
        m = entry.get("val_metrics", {})
        return (m.get("smape", 999), -m.get("skill_score", -999))

    prev_best = None
    for h in _hist_all:
        if (h.get("metric") == metric
                and h.get("model_type") == "arima"
                and h.get("regional") == reg_display
                and h.get("witel") == witel
                and h.get("val_metrics")
                and h.get("is_best") is True):
            if prev_best is None or _score(h) < _score(prev_best):
                prev_best = h

    curr_smape = metrics.get("smape", 999)
    curr_skill = metrics.get("skill_score", -999)
    is_best    = True
    benchmark  = None

    if prev_best is not None:
        pb_smape  = prev_best["val_metrics"].get("smape", 999)
        pb_skill  = prev_best["val_metrics"].get("skill_score", -999)
        benchmark = {
            "prev_smape":       pb_smape,
            "prev_skill_score": pb_skill,
            "prev_trained_at":  prev_best.get("trained_at"),
        }
        is_best = (curr_smape, -curr_skill) < (pb_smape, -pb_skill)

    if is_best:
        model_path.write_bytes(pickle.dumps(final_model))
        logger.info(
            f"[ARIMA] ✅ Model disimpan: {model_path.name}"
            + (f" (sMAPE {curr_smape:.2f}% vs prev {benchmark['prev_smape']:.2f}%)" if benchmark else "")
        )
    else:
        logger.info(f"[ARIMA] ⏭ Model lama lebih baik — tidak overwrite {model_path.name}")

    # ── 5. Prediksi bulan berikutnya ──────────────────────────────────────────
    all_vals   = df["value"].values
    raw_last   = float(all_vals[-1])
    median_val = float(np.median(all_vals[:-1])) if len(all_vals) > 1 else raw_last
    partial    = (median_val > 0 and raw_last < median_val * 0.30)

    if partial and len(df) >= 2:
        last_actual = float(df["value"].iloc[-2])
        last_period = str(df["periode"].iloc[-2])[:7]
        logger.warning(f"[ARIMA] Partial data terdeteksi — referensi: {last_period}")
    else:
        last_actual = raw_last
        last_period = str(df["periode"].iloc[-1])[:7]

    pred_val, ci_lower, ci_upper = _predict_one(final_model, alpha=0.10)
    next_period = str(pd.Timestamp(last_period + "-01") + pd.DateOffset(months=1))[:7]
    change_pct  = round((pred_val - last_actual) / max(abs(last_actual), 1) * 100, 2)

    arima_meta = {
        "order":         list(final_model.order),
        "seasonal_order": list(final_model.seasonal_order),
        "aic":           round(float(final_model.aic()), 2),
        "use_seasonal":  use_seasonal,
    }

    # ── 6. Simpan history ──────────────────────────────────────────────────────
    result = {
        "status":          "success",
        "model_type":      "arima",
        "metric":          metric,
        "regional":        reg_display,
        "witel":           witel,
        "data_points":     n_data,
        "window_size":     None,
        "n_test":          n_test,
        "auto_tuned":      True,
        "epochs_run":      None,
        "eval_method":     "walk-forward",
        "arima_meta":      arima_meta,
        "last_period":     last_period,
        "last_actual":     round(last_actual, 2),
        "forecast_period": next_period,
        "prediction":      round(pred_val, 2),
        "change_pct":      change_pct,
        "val_metrics":     metrics,
        "is_best":         is_best,
        "benchmark":       benchmark,
        "model_path":      str(model_path),
        "trained_at":      datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    _hist_all.append(result)
    history_path.write_text(json.dumps(_hist_all, indent=2, default=str))

    # Update tabel hasil internal
    try:
        from utils.results_writer import update_results
        update_results(
            model_type="arima",
            metric=metric,
            regional=reg_display,
            witel=witel,
            val_metrics=metrics,
            data_points=n_data,
            n_test=n_test,
            trained_at=result["trained_at"],
        )
    except Exception as e:
        logger.warning(f"[RESULTS] Gagal update tabel hasil: {e}")

    return result
