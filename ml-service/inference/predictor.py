"""
inference/predictor.py
Load model yang sudah ditraining → buat prediksi 1 bulan kedepan.
Mendukung GRU, LSTM, dan TFT.
"""
from __future__ import annotations

import logging
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

ModelType = Literal["gru", "lstm", "tft"]


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

    last_actual = float(df["value"].iloc[-1])
    last_period = str(df["periode"].iloc[-1])[:7]

    next_period = str(pd.Timestamp(last_period) + pd.DateOffset(months=1))[:7]

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
    import pandas as pd
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


def predict(
    model_type: ModelType,
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
) -> dict:
    """Entry point tunggal untuk semua model."""
    if model_type == "tft":
        return predict_tft(metric, regional, witel)
    return predict_gru_lstm(model_type, metric, regional, witel)
