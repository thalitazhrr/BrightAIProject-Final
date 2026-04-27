"""
training/trainer.py
Training pipeline untuk GRU dan LSTM.
TFT training ada di tft_trainer.py (menggunakan PyTorch Lightning).
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset

import config
from data.fetcher import get_series, aggregate_national, regional_display
from utils.preprocessing import prepare_series, make_windows, train_val_split
from utils.metrics import all_metrics
from models.gru_model import GRUForecaster
from models.lstm_model import LSTMForecaster

logger = logging.getLogger(__name__)

ModelType = Literal["gru", "lstm"]


def _model_tag(model_type: str, metric: str, regional: str, witel: Optional[str]) -> str:
    """
    Buat nama tag unik untuk file model.
    Contoh:
      gru_order_hsi_nasional
      gru_order_hsi_reg1
      gru_order_hsi_reg2_witel_jatim_utara
    """
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


def train(
    model_type: ModelType,
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
    window_size: int = config.WINDOW_SIZE,
    horizon: int = config.HORIZON,
    epochs: int = config.EPOCHS,
    batch_size: int = config.BATCH_SIZE,
    lr: float = config.LEARNING_RATE,
) -> dict:
    """
    Latih GRU atau LSTM untuk metrik & scope (regional / witel) tertentu.

    regional: 'NASIONAL', '1'-'5', 'REG-1'-'REG-5', 'TREG1'-'TREG5'
    witel:    nama witel spesifik, atau None untuk level regional
    """
    reg_display = regional_display(regional)
    log_scope   = reg_display + (f" / {witel}" if witel else "")
    logger.info(f"[TRAIN] {model_type.upper()} | {metric} | {log_scope}")

    # 1. Ambil & siapkan data
    model_path, scaler_path = _model_paths(model_type, metric, reg_display, witel)

    is_nasional = regional.upper() == "NASIONAL" and not witel
    reg_param   = None if is_nasional else regional

    df = get_series(metric, reg_param, witel)

    if is_nasional:
        df = aggregate_national(df)

    if len(df) < window_size + horizon + 5:
        raise ValueError(
            f"Data terlalu sedikit: {len(df)} baris (butuh min {window_size + horizon + 5})"
        )

    scaled, _ = prepare_series(df, scaler_path)

    # 2. Sliding windows
    X, y = make_windows(scaled, window_size, horizon)
    X_tr, y_tr, X_val, y_val = train_val_split(X, y)

    # 3. DataLoader
    train_loader = DataLoader(
        TensorDataset(torch.tensor(X_tr), torch.tensor(y_tr)),
        batch_size=batch_size, shuffle=True
    )
    val_loader = DataLoader(
        TensorDataset(torch.tensor(X_val), torch.tensor(y_val)),
        batch_size=batch_size
    )

    # 4. Bangun model
    ModelClass = GRUForecaster if model_type == "gru" else LSTMForecaster
    model = ModelClass(
        input_size=1,
        hidden_size=config.HIDDEN_SIZE,
        num_layers=config.NUM_LAYERS,
        dropout=config.DROPOUT,
        horizon=horizon,
    )

    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, patience=10, factor=0.5
    )

    # 5. Training loop
    best_val_loss = float("inf")
    best_state    = None

    for epoch in range(1, epochs + 1):
        model.train()
        for xb, yb in train_loader:
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

        model.eval()
        val_losses = []
        with torch.no_grad():
            for xb, yb in val_loader:
                val_losses.append(criterion(model(xb), yb).item())
        val_loss = np.mean(val_losses)
        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.clone() for k, v in model.state_dict().items()}

        if epoch % 20 == 0:
            logger.info(f"  Epoch {epoch}/{epochs} — val_loss: {val_loss:.6f}")

    # 6. Simpan model terbaik
    model.load_state_dict(best_state)
    torch.save(
        {
            "state_dict":  model.state_dict(),
            "model_type":  model_type,
            "metric":      metric,
            "regional":    reg_display,
            "witel":       witel,
            "window_size": window_size,
            "horizon":     horizon,
            "hidden_size": config.HIDDEN_SIZE,
            "num_layers":  config.NUM_LAYERS,
            "dropout":     config.DROPOUT,
        },
        model_path,
    )
    logger.info(f"[TRAIN] Model disimpan: {model_path}")

    # 7. Evaluasi di validation set (skala asli)
    from utils.preprocessing import load_scaler, inverse_scale
    scaler = load_scaler(scaler_path)

    model.eval()
    preds, actuals = [], []
    with torch.no_grad():
        for xb, yb in val_loader:
            pred = model(xb).numpy()
            preds.append(pred)
            actuals.append(yb.numpy())

    preds   = inverse_scale(np.concatenate(preds).flatten(),   scaler)
    actuals = inverse_scale(np.concatenate(actuals).flatten(), scaler)

    # y_train untuk MASE & Skill Score: pakai data training (skala asli)
    y_train_raw = inverse_scale(scaled[:int(len(scaled) * 0.8)], scaler)
    metrics = all_metrics(actuals, preds, y_train=y_train_raw, m=12)
    logger.info(f"[TRAIN] Metrics: {metrics}")

    # Log KPI pass/fail
    kpi = metrics.get("kpi", {})
    logger.info(
        f"[TRAIN] KPI — MASE<1: {kpi.get('mase_ok','?')} | "
        f"sMAPE<15%: {kpi.get('smape_short_ok','?')} | "
        f"sMAPE<25%: {kpi.get('smape_med_ok','?')} | "
        f"Skill>0.2: {kpi.get('skill_ok','?')}"
    )

    result = {
        "status":      "success",
        "model_type":  model_type,
        "metric":      metric,
        "regional":    reg_display,
        "witel":       witel,
        "data_points": len(df),
        "val_metrics": metrics,
        "model_path":  str(model_path),
        "trained_at":  datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    # Simpan ke training_history.json
    history_path = config.SAVED_MODELS_DIR / "training_history.json"
    history = []
    if history_path.exists():
        try:
            history = json.loads(history_path.read_text())
        except Exception:
            history = []
    history.append(result)
    history_path.write_text(json.dumps(history, indent=2, default=str))

    return result
