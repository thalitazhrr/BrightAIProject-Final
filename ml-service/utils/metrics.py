"""
utils/metrics.py
Evaluasi model time series — semua metrik KPI yang dibutuhkan:
  - MAE, RMSE, MAPE    (dasar)
  - sMAPE              (symmetric, tidak bias ke over/under forecast)
  - MASE               (bandingkan vs seasonal naive m=12)
  - Skill Score        (1 - MAE_model / MAE_baseline)
"""
from __future__ import annotations
import numpy as np


EPS = 1e-8


def mae(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs(y_true - y_pred)))


def rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def mape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    return float(np.mean(np.abs((y_true - y_pred) / (np.abs(y_true) + EPS))) * 100)


def smape(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """
    Symmetric MAPE — tidak bias ke over/under forecast.
    Range: 0-200%.  Target: < 15% (short), < 25% (medium).
    """
    return float(
        np.mean(
            2 * np.abs(y_pred - y_true) / (np.abs(y_true) + np.abs(y_pred) + EPS)
        ) * 100
    )


def mase(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_train: np.ndarray,
    m: int = 12,
) -> float:
    """
    Mean Absolute Scaled Error vs seasonal naive (lag-m).
    m=12 untuk data bulanan (1 tahun).
    Target: MASE < 1.0 → model lebih baik dari naive forecast.

    y_train: data training (dipakai untuk menghitung skala naive).
    """
    if len(y_train) > m:
        naive_errors = np.abs(y_train[m:] - y_train[:-m])   # |y_t - y_{t-m}|
    else:
        naive_errors = np.abs(np.diff(y_train))              # fallback: lag-1

    naive_mae = float(np.mean(naive_errors)) if len(naive_errors) > 0 else EPS
    return float(np.mean(np.abs(y_true - y_pred)) / (naive_mae + EPS))


def seasonal_naive_forecast(y_train: np.ndarray, n_steps: int, m: int = 12) -> np.ndarray:
    """
    Baseline: prediksi = nilai pada periode yang sama tahun lalu (lag-m).
    Dipakai sebagai pembanding untuk Skill Score.
    """
    preds = []
    n = len(y_train)
    for i in range(n_steps):
        idx = n - m + (i % m)
        preds.append(y_train[idx] if idx >= 0 else y_train[0])
    return np.array(preds)


def skill_score(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_baseline: np.ndarray,
) -> float:
    """
    Skill Score = 1 - MAE(model) / MAE(baseline).
    > 0    → model lebih baik dari baseline.
    > 0.20 → target KPI terpenuhi.
    = 1.0  → model sempurna.
    """
    mae_model    = np.mean(np.abs(y_true - y_pred))
    mae_baseline = np.mean(np.abs(y_true - y_baseline))
    return float(1.0 - mae_model / (mae_baseline + EPS))


def all_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_train: np.ndarray | None = None,
    m: int = 12,
) -> dict:
    """
    Hitung semua metrik sekaligus.
    y_train dibutuhkan untuk MASE dan Skill Score.
    Jika tidak diberikan, MASE dan skill_score di-skip.
    """
    result = {
        "mae":   round(mae(y_true, y_pred), 4),
        "rmse":  round(rmse(y_true, y_pred), 4),
        "mape":  round(mape(y_true, y_pred), 4),
        "smape": round(smape(y_true, y_pred), 4),
    }

    if y_train is not None and len(y_train) > 0:
        baseline = seasonal_naive_forecast(y_train, len(y_true), m=m)
        result["mase"]        = round(mase(y_true, y_pred, y_train, m=m), 4)
        result["skill_score"] = round(skill_score(y_true, y_pred, baseline), 4)

    # KPI status (pass/fail)
    result["kpi"] = {
        "mase_ok":        result.get("mase", 999) < 1.0,
        "smape_short_ok": result["smape"] < 15.0,
        "smape_med_ok":   result["smape"] < 25.0,
        "skill_ok":       result.get("skill_score", -999) > 0.20,
    }

    return result
