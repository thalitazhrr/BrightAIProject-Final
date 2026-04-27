"""
utils/preprocessing.py
Normalisasi, pembuatan sliding window, dan train/val split.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
import joblib
from pathlib import Path
from typing import Tuple

import config


def scale_series(values: np.ndarray, scaler_path: Path) -> Tuple[np.ndarray, MinMaxScaler]:
    """Fit MinMaxScaler dan simpan ke disk. Return array ternormalisasi."""
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled = scaler.fit_transform(values.reshape(-1, 1)).flatten()
    joblib.dump(scaler, scaler_path)
    return scaled, scaler


def load_scaler(scaler_path: Path) -> MinMaxScaler:
    return joblib.load(scaler_path)


def inverse_scale(values: np.ndarray, scaler: MinMaxScaler) -> np.ndarray:
    return scaler.inverse_transform(values.reshape(-1, 1)).flatten()


def make_windows(
    series: np.ndarray,
    window_size: int = config.WINDOW_SIZE,
    horizon: int = config.HORIZON,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Buat pasangan (X, y) untuk supervised learning.
    X: (n_samples, window_size, 1)
    y: (n_samples, horizon)
    """
    X, y = [], []
    for i in range(len(series) - window_size - horizon + 1):
        X.append(series[i : i + window_size])
        y.append(series[i + window_size : i + window_size + horizon])
    X = np.array(X, dtype=np.float32)[:, :, np.newaxis]  # (n, W, 1)
    y = np.array(y, dtype=np.float32)                     # (n, H)
    return X, y


def train_val_split(
    X: np.ndarray,
    y: np.ndarray,
    val_ratio: float = 0.2,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    split = int(len(X) * (1 - val_ratio))
    return X[:split], y[:split], X[split:], y[split:]


def prepare_series(df: pd.DataFrame, scaler_path: Path) -> Tuple[np.ndarray, MinMaxScaler]:
    """
    Input : DataFrame dengan kolom 'periode' dan 'value'
    Output: scaled numpy array + fitted scaler
    """
    df = df.sort_values("periode").dropna(subset=["value"])
    values = df["value"].values.astype(np.float64)
    scaled, scaler = scale_series(values, scaler_path)
    return scaled, scaler
