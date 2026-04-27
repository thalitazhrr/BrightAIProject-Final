"""
models/tft_model.py
TFT (Temporal Fusion Transformer) menggunakan library pytorch-forecasting.
Keunggulan vs GRU/LSTM:
  - Handle multiple time series sekaligus (per regional)
  - Static covariates (regional sebagai kategori)
  - Time-varying known (bulan, kuartal sebagai calendar features)
  - Output prediction interval (10%, 50%, 90%)
  - Interpretable: attention weights per time step

Membutuhkan lebih banyak data (minimal 24 bulan, idealnya 36+).
"""
from __future__ import annotations

import pandas as pd
import numpy as np
import torch
import pytorch_lightning as pl
from pytorch_forecasting import (
    TemporalFusionTransformer,
    TimeSeriesDataSet,
)
from pytorch_forecasting.data import GroupNormalizer
from pytorch_forecasting.metrics import QuantileLoss
from pathlib import Path
from typing import Optional

import config


def build_tft_dataset(
    df: pd.DataFrame,
    max_encoder_length: int = 24,
    max_prediction_length: int = 1,
    training_cutoff_idx: Optional[int] = None,
) -> tuple[TimeSeriesDataSet, TimeSeriesDataSet]:
    """
    Siapkan TimeSeriesDataSet untuk training dan validasi.

    df harus memiliki kolom: periode (datetime), regional (str), value (float)
    """
    df = df.copy().sort_values("periode")

    # Buat integer time index per group
    df["time_idx"] = (
        df.groupby("regional")
        .cumcount()
    )

    # Calendar features sebagai time-varying known
    df["month"]   = df["periode"].dt.month.astype(str)
    df["quarter"] = df["periode"].dt.quarter.astype(str)
    df["year"]    = df["periode"].dt.year.astype(str)

    # Cutoff untuk val split
    if training_cutoff_idx is None:
        max_idx = df["time_idx"].max()
        training_cutoff_idx = max_idx - max_prediction_length

    training = TimeSeriesDataSet(
        df[df["time_idx"] <= training_cutoff_idx],
        time_idx="time_idx",
        target="value",
        group_ids=["regional"],
        max_encoder_length=max_encoder_length,
        max_prediction_length=max_prediction_length,
        static_categoricals=["regional"],
        time_varying_known_categoricals=["month", "quarter", "year"],
        time_varying_unknown_reals=["value"],
        target_normalizer=GroupNormalizer(groups=["regional"], transformation="softplus"),
        add_relative_time_idx=True,
        add_target_scales=True,
        add_encoder_length=True,
    )

    validation = TimeSeriesDataSet.from_dataset(
        training,
        df,
        predict=True,
        stop_randomization=True,
    )

    return training, validation


def build_tft_model(training_dataset: TimeSeriesDataSet) -> TemporalFusionTransformer:
    return TemporalFusionTransformer.from_dataset(
        training_dataset,
        learning_rate=config.LEARNING_RATE,
        hidden_size=config.HIDDEN_SIZE,
        attention_head_size=4,
        dropout=config.DROPOUT,
        hidden_continuous_size=16,
        loss=QuantileLoss(quantiles=[0.1, 0.5, 0.9]),
        log_interval=10,
        reduce_on_plateau_patience=4,
    )
