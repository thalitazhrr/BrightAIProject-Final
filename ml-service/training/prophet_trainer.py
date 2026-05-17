"""
training/prophet_trainer.py
Training Prophet sebagai baseline model dengan walk-forward validation.

Prophet = model additif: y(t) = g(t) + s(t) + h(t) + ε
  - g(t): trend piecewise linear dengan changepoints otomatis
  - s(t): seasonality tahunan (Fourier series)
  - h(t): efek hari libur (Idul Fitri, Idul Adha)
"""
from __future__ import annotations

import json
import logging
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
    tag = f"prophet_{metric}_{reg_part}"
    if witel:
        tag += f"_{witel.lower().replace(' ', '_')}"
    return tag


def _model_path(metric: str, regional: str, witel: Optional[str] = None) -> Path:
    return config.SAVED_MODELS_DIR / f"{_model_tag(metric, regional, witel)}.json"


def _make_prophet_df(df: pd.DataFrame) -> pd.DataFrame:
    """Convert Oracle df → Prophet format: ds (datetime), y (value)."""
    return pd.DataFrame({
        "ds": pd.to_datetime(df["periode"].astype(str).str[:7] + "-01"),
        "y":  df["value"].astype(float).values,
    }).sort_values("ds").reset_index(drop=True)


def _indonesian_holidays() -> pd.DataFrame:
    """Idul Fitri dan Idul Adha 2018–2028 sebagai holiday effects."""
    lebaran = [
        "2018-06-15", "2019-06-05", "2020-05-24", "2021-05-13",
        "2022-05-02", "2023-04-21", "2024-04-10", "2025-03-30",
        "2026-03-20", "2027-03-09", "2028-02-27",
    ]
    idul_adha = [
        "2018-08-22", "2019-08-11", "2020-07-31", "2021-07-20",
        "2022-07-09", "2023-06-28", "2024-06-17", "2025-06-06",
        "2026-05-26", "2027-05-16", "2028-05-04",
    ]
    rows = (
        [{"holiday": "lebaran",    "ds": d, "lower_window": -2, "upper_window": 3} for d in lebaran] +
        [{"holiday": "idul_adha",  "ds": d, "lower_window": -1, "upper_window": 2} for d in idul_adha]
    )
    df = pd.DataFrame(rows)
    df["ds"] = pd.to_datetime(df["ds"])
    return df


def _build_prophet(n_data: int):
    """
    Buat Prophet model dengan konfigurasi telecom monthly Indonesia.
    Gunakan multiplicative jika data >= 24 bulan (lebih stabil untuk tren bertumbuh).
    """
    from prophet import Prophet
    mode = "multiplicative" if n_data >= 24 else "additive"
    return Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False,
        seasonality_mode=mode,
        changepoint_prior_scale=0.05,
        seasonality_prior_scale=10.0,
        interval_width=0.90,
        holidays=_indonesian_holidays(),
    )


# ── Entry point ───────────────────────────────────────────────────────────────

def train_prophet(
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
) -> dict:
    """
    Latih Prophet dengan walk-forward validation → simpan model .json.
    Fungsi ini mengikuti output format yang sama dengan training/trainer.py.
    """
    try:
        from prophet.serialize import model_to_json  # noqa: F401
    except ImportError:
        raise RuntimeError("prophet tidak terinstall. Jalankan: pip install prophet")

    reg_display = regional_display(regional)
    log_scope   = reg_display + (f" / {witel}" if witel else "")
    logger.info(f"[PROPHET] Training | {metric} | {log_scope}")

    is_nasional = regional.upper() == "NASIONAL" and not witel
    reg_param   = None if is_nasional else regional

    # ── 1. Ambil data ──────────────────────────────────────────────────────────
    df = get_series(metric, reg_param, witel)
    if is_nasional:
        df = aggregate_national(df)

    df     = df.sort_values("periode")
    n_data = len(df)
    logger.info(f"[PROPHET] {n_data} bulan data tersedia")

    if n_data < 12:
        raise ValueError(f"Data terlalu sedikit untuk Prophet: {n_data} baris (butuh min 12)")

    prophet_df = _make_prophet_df(df)

    # ── 2. Walk-forward evaluation ─────────────────────────────────────────────
    n_test = max(3, min(6, n_data // 7))
    logger.info(f"[PROPHET] Walk-forward: {n_test} langkah")

    preds, actuals = [], []
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        for i in range(n_test):
            train_end = n_data - n_test + i
            if train_end < 6:
                continue
            train_df = prophet_df.iloc[:train_end].copy()
            model = _build_prophet(len(train_df))
            model.fit(train_df)

            next_ds  = train_df["ds"].max() + pd.DateOffset(months=1)
            forecast = model.predict(pd.DataFrame({"ds": [next_ds]}))

            preds.append(float(forecast["yhat"].iloc[0]))
            actuals.append(float(prophet_df["y"].iloc[train_end]))

    preds_arr   = np.array(preds, dtype=np.float32)
    actuals_arr = np.array(actuals, dtype=np.float32)
    y_all_real  = df["value"].values.astype(np.float32)

    metrics = all_metrics(actuals_arr, preds_arr, y_train=y_all_real, m=12)
    logger.info(f"[PROPHET] Metrics: {metrics}")

    kpi = metrics.get("kpi", {})
    logger.info(
        f"[PROPHET] KPI — MASE<1: {kpi.get('mase_ok','?')} | "
        f"sMAPE<30%: {kpi.get('smape_short_ok','?')} | "
        f"Skill>-0.1: {kpi.get('skill_ok','?')}"
    )

    # ── 3. Final model pada semua data ─────────────────────────────────────────
    logger.info(f"[PROPHET] Training final model ({n_data} bulan) ...")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        final_model = _build_prophet(n_data)
        final_model.fit(prophet_df)

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
                and h.get("model_type") == "prophet"
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
        from prophet.serialize import model_to_json
        model_path.write_text(model_to_json(final_model), encoding="utf-8")
        logger.info(
            f"[PROPHET] ✅ Model disimpan: {model_path.name}"
            + (f" (sMAPE {curr_smape:.2f}% vs prev {benchmark['prev_smape']:.2f}%)" if benchmark else "")
        )
    else:
        logger.info(f"[PROPHET] ⏭ Model lama lebih baik — tidak overwrite {model_path.name}")

    # ── 5. Prediksi bulan berikutnya ──────────────────────────────────────────
    all_vals   = df["value"].values
    raw_last   = float(all_vals[-1])
    median_val = float(np.median(all_vals[:-1])) if len(all_vals) > 1 else raw_last
    partial    = (median_val > 0 and raw_last < median_val * 0.30)

    if partial and len(df) >= 2:
        last_actual = float(df["value"].iloc[-2])
        last_period = str(df["periode"].iloc[-2])[:7]
        logger.warning(f"[PROPHET] Partial data terdeteksi — referensi: {last_period}")
    else:
        last_actual = raw_last
        last_period = str(df["periode"].iloc[-1])[:7]

    last_ds    = prophet_df["ds"].max()
    future_ds  = last_ds + pd.DateOffset(months=1)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        forecast = final_model.predict(pd.DataFrame({"ds": [future_ds]}))

    pred_val  = max(0.0, float(forecast["yhat"].iloc[0]))
    ci_lower  = max(0.0, round(float(forecast["yhat_lower"].iloc[0]), 2))
    ci_upper  = round(float(forecast["yhat_upper"].iloc[0]), 2)
    next_period = str(future_ds)[:7]
    change_pct  = round((pred_val - last_actual) / max(abs(last_actual), 1) * 100, 2)

    # ── 6. Simpan history ──────────────────────────────────────────────────────
    result = {
        "status":          "success",
        "model_type":      "prophet",
        "metric":          metric,
        "regional":        reg_display,
        "witel":           witel,
        "data_points":     n_data,
        "window_size":     None,
        "n_test":          n_test,
        "auto_tuned":      True,
        "epochs_run":      None,
        "eval_method":     "walk-forward",
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

    return result
