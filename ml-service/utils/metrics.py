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
    """
    MAPE dengan filter nilai aktual terlalu kecil (< 1% dari mean).
    Mencegah explosion ketika ada bulan dengan nilai mendekati nol.
    """
    threshold = max(1.0, np.mean(np.abs(y_true)) * 0.01)
    mask = np.abs(y_true) >= threshold
    if mask.sum() == 0:
        return float("nan")
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / (np.abs(y_true[mask]) + EPS))) * 100)


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
    Jika baseline MAE ≈ 0 (data sangat stabil), kembalikan 0.0 (neutral).
    """
    mae_model    = np.mean(np.abs(y_true - y_pred))
    mae_baseline = np.mean(np.abs(y_true - y_baseline))
    if mae_baseline < 1e-4:
        return 0.0
    return float(max(-10.0, 1.0 - mae_model / mae_baseline))


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

    # KPI status (pass/fail) — short-term forecast (horizon=1 bulan)
    # sMAPE <30% (acceptable industri), Skill >-0.1 (model tidak lebih dari 10% lebih buruk dari naive)
    result["kpi"] = {
        "mase_ok":        result.get("mase", 999) < 1.0,
        "smape_short_ok": result["smape"] < 30.0,
        "skill_ok":       result.get("skill_score", -999) > -0.1,
    }

    return result
