"""
inference/predictor.py
Load model yang sudah ditraining → buat prediksi 1 bulan kedepan.
Mendukung GRU, LSTM, dan TFT.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Literal, Optional

import numpy as np
import pandas as pd
import torch

import config
from data.fetcher import get_series, aggregate_national, regional_display
from models.gru_model import GRUForecaster
from models.lstm_model import LSTMForecaster
from utils.preprocessing import load_scaler, inverse_scale

logger = logging.getLogger(__name__)

ModelType = Literal["gru", "lstm", "tft", "prophet", "arima"]


def _model_tag(model_type: str, metric: str, regional: str, witel: Optional[str]) -> str:
    reg_part = regional.lower().replace("-", "").replace(" ", "_")
    tag = f"{model_type}_{metric}_{reg_part}"
    if witel:
        witel_part = witel.lower().replace(" ", "_")
        tag += f"_{witel_part}"
    return tag


def _model_paths(
    model_type: str,
    metric: str,
    regional: str,
    witel: Optional[str] = None,
) -> tuple[Path, Path]:
    tag = _model_tag(model_type, metric, regional, witel)
    return (
        config.SAVED_MODELS_DIR / f"{tag}.pth",
        config.SAVED_MODELS_DIR / f"{tag}_scaler.pkl",
    )


def _load_gru_lstm(model_path: Path) -> tuple:
    """Load GRU atau LSTM checkpoint."""
    ckpt = torch.load(model_path, map_location="cpu")
    ModelClass = GRUForecaster if ckpt["model_type"] == "gru" else LSTMForecaster
    model = ModelClass(
        input_size=1,
        hidden_size=ckpt["hidden_size"],
        num_layers=ckpt["num_layers"],
        dropout=ckpt["dropout"],
        horizon=ckpt["horizon"],
    )
    model.load_state_dict(ckpt["state_dict"])
    model.eval()
    return model, ckpt


def predict_gru_lstm(
    model_type: Literal["gru", "lstm"],
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
) -> dict:
    """
    Ambil data terbaru dari Oracle → prediksi bulan berikutnya.
    """
    _t_start = time.perf_counter()
    reg_display = regional_display(regional)
    is_nasional = reg_display == "NASIONAL" and not witel
    reg_param   = None if is_nasional else regional

    model_path, scaler_path = _model_paths(model_type, metric, reg_display, witel)

    if not model_path.exists():
        raise FileNotFoundError(
            f"Model belum ditraining: {model_path.name}. "
            "Jalankan POST /forecast/train terlebih dahulu."
        )

    model, ckpt = _load_gru_lstm(model_path)
    scaler      = load_scaler(scaler_path)
    window_size = ckpt["window_size"]

    # Ambil data terbaru dari Oracle
    df = get_series(metric, reg_param, witel)
    if is_nasional:
        df = aggregate_national(df)

    df = df.sort_values("periode")
    if len(df) < window_size:
        raise ValueError(
            f"Data terlalu sedikit untuk prediksi: {len(df)} baris (butuh {window_size})"
        )

    # Window terakhir → prediksi
    last_values = df["value"].values[-window_size:]
    scaled = scaler.transform(last_values.reshape(-1, 1)).flatten()

    x = torch.tensor(scaled, dtype=torch.float32).unsqueeze(0).unsqueeze(-1)  # (1, W, 1)

    with torch.no_grad():
        pred_scaled = model(x).numpy().flatten()

    pred_value = float(inverse_scale(pred_scaled, scaler)[0])
    pred_value = max(0.0, pred_value)  # nilai tidak boleh negatif

    ci_lower = round(pred_value * 0.90, 2)
    ci_upper = round(pred_value * 1.10, 2)

    # Deteksi partial/incomplete data di bulan terakhir:
    # jika nilai terakhir < 30% dari median historis, anggap data belum lengkap
    # → pakai bulan sebelumnya sebagai referensi last_actual
    values_all = df["value"].values
    median_val = float(np.median(values_all[:-1])) if len(values_all) > 1 else float(values_all[-1])
    last_raw   = float(df["value"].iloc[-1])
    partial_data = (median_val > 0 and last_raw < median_val * 0.30)

    if partial_data and len(df) >= 2:
        last_actual = float(df["value"].iloc[-2])
        last_period = str(df["periode"].iloc[-2])[:7]
        logger.warning(
            f"[INFERENCE] Data bulan terakhir terdeteksi partial "
            f"({last_raw:.0f} vs median {median_val:.0f}) — pakai periode sebelumnya: {last_period}"
        )
    else:
        last_actual = last_raw
        last_period = str(df["periode"].iloc[-1])[:7]

    next_period = str(pd.Timestamp(last_period) + pd.DateOffset(months=1))[:7]

    inference_ms = round((time.perf_counter() - _t_start) * 1000, 1)
    logger.info(f"[INFERENCE] {model_type.upper()} {metric} {reg_display}{'/'+witel if witel else ''} → {round(pred_value,2)} | {inference_ms}ms")

    return {
        "metric":      metric,
        "regional":    reg_display,
        "witel":       witel,
        "model_used":  model_type.upper(),
        "last_period": last_period,
        "last_actual": round(last_actual, 2),
        "forecast_period": next_period,
        "prediction":  round(pred_value, 2),
        "confidence_interval": {
            "lower": ci_lower,
            "upper": ci_upper,
            "level": "90%",
        },
        "change_pct": round((pred_value - last_actual) / max(last_actual, 1) * 100, 2),
        "inference_ms": inference_ms,
        "partial_data_warning": partial_data,
    }


def predict_tft(
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
) -> dict:
    """Load TFT checkpoint terbaru dan buat prediksi."""
    try:
        from pytorch_forecasting import TemporalFusionTransformer
    except ImportError:
        raise RuntimeError(
            "pytorch-forecasting tidak terinstall. Jalankan: pip install pytorch-forecasting"
        )

    scope       = regional_display(regional)
    is_nasional = scope == "NASIONAL" and not witel
    reg_param   = None if is_nasional else regional

    tag = _model_tag("tft", metric, scope, witel)
    checkpoints = sorted(
        config.SAVED_MODELS_DIR.glob(f"{tag}_*.ckpt"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not checkpoints:
        raise FileNotFoundError(
            f"TFT model belum ditraining untuk {metric}/{scope}. "
            "Jalankan POST /forecast/train dengan model_type=tft."
        )

    model = TemporalFusionTransformer.load_from_checkpoint(str(checkpoints[0]))
    model.eval()

    from models.tft_model import build_tft_dataset
    from torch.utils.data import DataLoader

    df = get_series(metric, reg_param, witel)
    if is_nasional:
        df = aggregate_national(df)

    _, val_ds = build_tft_dataset(df)
    val_loader = DataLoader(val_ds, batch_size=64)

    raw_preds = model.predict(val_loader, mode="quantiles", return_x=False)
    last = raw_preds[-1].numpy()  # (horizon, 3) — [q10, q50, q90]

    last_period = str(df["periode"].max())[:7]
    next_period = str(pd.Timestamp(last_period) + pd.DateOffset(months=1))[:7]

    return {
        "metric":      metric,
        "regional":    scope,
        "witel":       witel,
        "model_used":  "TFT",
        "last_period": last_period,
        "forecast_period": next_period,
        "prediction":  round(float(last[0, 1]), 2),
        "confidence_interval": {
            "lower": round(float(last[0, 0]), 2),
            "upper": round(float(last[0, 2]), 2),
            "level": "80%",
        },
    }


def predict_prophet(
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
) -> dict:
    """Load Prophet model (.json) dan prediksi 1 bulan ke depan."""
    try:
        from prophet.serialize import model_from_json
    except ImportError:
        raise RuntimeError("prophet tidak terinstall. Jalankan: pip install prophet")

    import warnings
    _t_start = time.perf_counter()
    reg_display = regional_display(regional)
    is_nasional = reg_display == "NASIONAL" and not witel
    reg_param   = None if is_nasional else regional

    # Path model
    reg_part = reg_display.lower().replace("-", "").replace(" ", "_")
    tag = f"prophet_{metric}_{reg_part}"
    if witel:
        tag += f"_{witel.lower().replace(' ', '_')}"
    model_path = config.SAVED_MODELS_DIR / f"{tag}.json"

    if not model_path.exists():
        raise FileNotFoundError(
            f"Prophet model belum ditraining: {model_path.name}. "
            "Jalankan POST /forecast/train dengan model_type=prophet terlebih dahulu."
        )

    with open(model_path, "r", encoding="utf-8") as f:
        model = model_from_json(f.read())

    # Ambil data terbaru untuk referensi last_period
    df = get_series(metric, reg_param, witel)
    if is_nasional:
        df = aggregate_national(df)
    df = df.sort_values("periode")

    # Deteksi partial data
    all_vals   = df["value"].values
    raw_last   = float(all_vals[-1])
    median_val = float(np.median(all_vals[:-1])) if len(all_vals) > 1 else raw_last
    partial    = (median_val > 0 and raw_last < median_val * 0.30)

    if partial and len(df) >= 2:
        last_actual = float(df["value"].iloc[-2])
        last_period = str(df["periode"].iloc[-2])[:7]
        logger.warning(f"[INFERENCE] PROPHET partial data — pakai periode: {last_period}")
    else:
        last_actual = raw_last
        last_period = str(df["periode"].iloc[-1])[:7]

    future_ds = pd.Timestamp(last_period + "-01") + pd.DateOffset(months=1)
    future    = pd.DataFrame({"ds": [future_ds]})

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        forecast = model.predict(future)

    pred_val  = max(0.0, float(forecast["yhat"].iloc[0]))
    ci_lower  = max(0.0, round(float(forecast["yhat_lower"].iloc[0]), 2))
    ci_upper  = round(float(forecast["yhat_upper"].iloc[0]), 2)
    next_period  = str(future_ds)[:7]
    inference_ms = round((time.perf_counter() - _t_start) * 1000, 1)

    logger.info(f"[INFERENCE] PROPHET {metric} {reg_display}{'/'+witel if witel else ''} → {round(pred_val,2)} | {inference_ms}ms")

    return {
        "metric":      metric,
        "regional":    reg_display,
        "witel":       witel,
        "model_used":  "PROPHET",
        "last_period": last_period,
        "last_actual": round(last_actual, 2),
        "forecast_period": next_period,
        "prediction":  round(pred_val, 2),
        "confidence_interval": {
            "lower": ci_lower,
            "upper": ci_upper,
            "level": "90%",
        },
        "change_pct": round((pred_val - last_actual) / max(abs(last_actual), 1) * 100, 2),
        "inference_ms": inference_ms,
        "partial_data_warning": partial,
    }


def predict_arima(
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
) -> dict:
    """Load ARIMA model (.pkl) dan prediksi 1 bulan ke depan."""
    import pickle
    import warnings
    _t_start = time.perf_counter()
    reg_display = regional_display(regional)
    is_nasional = reg_display == "NASIONAL" and not witel
    reg_param   = None if is_nasional else regional

    reg_part = reg_display.lower().replace("-", "").replace(" ", "_")
    tag = f"arima_{metric}_{reg_part}"
    if witel:
        tag += f"_{witel.lower().replace(' ', '_')}"
    model_path = config.SAVED_MODELS_DIR / f"{tag}.pkl"

    if not model_path.exists():
        raise FileNotFoundError(
            f"ARIMA model belum ditraining: {model_path.name}. "
            "Jalankan POST /forecast/train dengan model_type=arima terlebih dahulu."
        )

    model = pickle.loads(model_path.read_bytes())

    # Ambil data terbaru untuk referensi last_period
    df = get_series(metric, reg_param, witel)
    if is_nasional:
        df = aggregate_national(df)
    df = df.sort_values("periode")

    all_vals   = df["value"].values
    raw_last   = float(all_vals[-1])
    median_val = float(np.median(all_vals[:-1])) if len(all_vals) > 1 else raw_last
    partial    = (median_val > 0 and raw_last < median_val * 0.30)

    if partial and len(df) >= 2:
        last_actual = float(df["value"].iloc[-2])
        last_period = str(df["periode"].iloc[-2])[:7]
        logger.warning(f"[INFERENCE] ARIMA partial data — pakai periode: {last_period}")
    else:
        last_actual = raw_last
        last_period = str(df["periode"].iloc[-1])[:7]

    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        preds, conf = model.predict(n_periods=1, return_conf_int=True, alpha=0.10)

    pred_val  = max(0.0, float(preds[0]))
    ci_lower  = max(0.0, round(float(conf[0][0]), 2))
    ci_upper  = round(float(conf[0][1]), 2)
    next_period  = str(pd.Timestamp(last_period + "-01") + pd.DateOffset(months=1))[:7]
    inference_ms = round((time.perf_counter() - _t_start) * 1000, 1)

    logger.info(f"[INFERENCE] ARIMA {metric} {reg_display}{'/'+witel if witel else ''} → {round(pred_val,2)} | {inference_ms}ms")

    return {
        "metric":      metric,
        "regional":    reg_display,
        "witel":       witel,
        "model_used":  f"ARIMA{model.order}",
        "last_period": last_period,
        "last_actual": round(last_actual, 2),
        "forecast_period": next_period,
        "prediction":  round(pred_val, 2),
        "confidence_interval": {
            "lower": ci_lower,
            "upper": ci_upper,
            "level": "90%",
        },
        "change_pct": round((pred_val - last_actual) / max(abs(last_actual), 1) * 100, 2),
        "inference_ms": inference_ms,
        "partial_data_warning": partial,
    }


def predict(
    model_type: ModelType,
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
) -> dict:
    """Entry point tunggal untuk semua model."""
    if model_type == "tft":
        return predict_tft(metric, regional, witel)
    if model_type == "prophet":
        return predict_prophet(metric, regional, witel)
    if model_type == "arima":
        return predict_arima(metric, regional, witel)
    return predict_gru_lstm(model_type, metric, regional, witel)
