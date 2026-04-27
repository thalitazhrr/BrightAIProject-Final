"""
training/tft_trainer.py
Training pipeline khusus TFT menggunakan PyTorch Lightning.
"""
from __future__ import annotations

import logging
from typing import Optional

import pytorch_lightning as pl
from pytorch_lightning.callbacks import EarlyStopping, ModelCheckpoint
from torch.utils.data import DataLoader

import config
from data.fetcher import get_series, aggregate_national, regional_display
from models.tft_model import build_tft_dataset, build_tft_model

logger = logging.getLogger(__name__)


def train_tft(
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
    max_encoder_length: int = 24,
    max_prediction_length: int = 1,
    epochs: int = 50,
    batch_size: int = 64,
) -> dict:
    """
    Latih TFT untuk metrik & scope (regional / witel) tertentu.
    Model disimpan via ModelCheckpoint ke saved_models/.

    regional: 'NASIONAL', '1'-'5', 'REG-1'-'REG-5', 'TREG1'-'TREG5'
    witel:    nama witel spesifik, atau None untuk level regional
    """
    scope       = regional_display(regional)
    is_nasional = scope == "NASIONAL" and not witel
    reg_param   = None if is_nasional else regional

    logger.info(f"[TFT TRAIN] {metric} | {scope}" + (f" / {witel}" if witel else ""))

    df = get_series(metric, reg_param, witel)

    if is_nasional:
        df = aggregate_national(df)

    min_rows = max_encoder_length + max_prediction_length + 5
    if len(df) < min_rows:
        raise ValueError(f"Data terlalu sedikit: {len(df)} baris (butuh min {min_rows})")

    # Dataset
    training_ds, val_ds = build_tft_dataset(
        df,
        max_encoder_length=max_encoder_length,
        max_prediction_length=max_prediction_length,
    )

    train_loader = DataLoader(training_ds, batch_size=batch_size, shuffle=True)
    val_loader   = DataLoader(val_ds,      batch_size=batch_size)

    # Model
    model = build_tft_model(training_ds)

    # Tag file: tft_order_hsi_nasional, tft_order_hsi_reg1_witel_jatim_utara, ...
    reg_part = scope.lower().replace("-", "").replace(" ", "_")
    tag = f"tft_{metric}_{reg_part}"
    if witel:
        tag += f"_{witel.lower().replace(' ', '_')}"

    checkpoint_cb = ModelCheckpoint(
        dirpath=str(config.SAVED_MODELS_DIR),
        filename=tag + "_{epoch}-{val_loss:.4f}",
        monitor="val_loss",
        mode="min",
        save_top_k=1,
    )
    early_stop_cb = EarlyStopping(monitor="val_loss", patience=10, mode="min")

    trainer = pl.Trainer(
        max_epochs=epochs,
        accelerator="auto",
        gradient_clip_val=0.1,
        callbacks=[checkpoint_cb, early_stop_cb],
        enable_progress_bar=True,
        logger=False,
    )

    trainer.fit(model, train_loader, val_loader)

    best_path = checkpoint_cb.best_model_path
    logger.info(f"[TFT TRAIN] Best checkpoint: {best_path}")

    return {
        "status":     "success",
        "model_type": "tft",
        "metric":     metric,
        "regional":   scope,
        "witel":      witel,
        "checkpoint": best_path,
        "val_loss":   round(float(checkpoint_cb.best_model_score), 6),
    }
