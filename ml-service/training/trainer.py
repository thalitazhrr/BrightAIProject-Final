"""
training/trainer.py
Training pipeline untuk GRU dan LSTM.

Pendekatan:
  1. Auto-tune window_size (jika window=0) dengan mencoba beberapa kandidat.
  2. Walk-forward validation pada n_test bulan terakhir → sMAPE realistis 1-step.
  3. Model FINAL ditraining pada SEMUA data (tidak ada data yang terbuang).
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
import pandas as pd
from data.fetcher import get_series, aggregate_national, regional_display
from utils.preprocessing import prepare_series, make_windows, train_val_split, load_scaler, inverse_scale
from utils.metrics import all_metrics
from models.gru_model import GRUForecaster
from models.lstm_model import LSTMForecaster

logger = logging.getLogger(__name__)

ModelType = Literal["gru", "lstm"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _model_tag(model_type: str, metric: str, regional: str, witel: Optional[str]) -> str:
    reg_part = regional.lower().replace("-", "").replace(" ", "_")
    tag = f"{model_type}_{metric}_{reg_part}"
    if witel:
        tag += f"_{witel.lower().replace(' ', '_')}"
    return tag


def _model_paths(model_type, metric, regional, witel=None):
    tag = _model_tag(model_type, metric, regional, witel)
    return (
        config.SAVED_MODELS_DIR / f"{tag}.pth",
        config.SAVED_MODELS_DIR / f"{tag}_scaler.pkl",
    )


def _build_model(model_type: ModelType, horizon: int) -> nn.Module:
    ModelClass = GRUForecaster if model_type == "gru" else LSTMForecaster
    return ModelClass(
        input_size=1,
        hidden_size=config.HIDDEN_SIZE,
        num_layers=config.NUM_LAYERS,
        dropout=config.DROPOUT,
        horizon=horizon,
    )


def _train_single(
    model_type: ModelType,
    scaled: np.ndarray,
    window_size: int,
    horizon: int,
    epochs: int,
    batch_size: int,
    lr: float,
    early_stopping_patience: int = 25,
) -> tuple:
    """
    Latih satu model pada data `scaled`.
    Return (model, best_val_loss, epochs_run).
    Menggunakan 80/20 split internal hanya untuk memilih checkpoint terbaik.
    """
    X, y = make_windows(scaled, window_size, horizon)
    if len(X) < 4:
        raise ValueError(f"Terlalu sedikit sampel setelah windowing: {len(X)}")

    X_tr, y_tr, X_val, y_val = train_val_split(X, y, val_ratio=0.2)

    # Jika val terlalu kecil, pakai semua untuk train+val
    if len(X_val) == 0:
        X_val, y_val = X_tr, y_tr

    train_loader = DataLoader(
        TensorDataset(torch.tensor(X_tr), torch.tensor(y_tr)),
        batch_size=max(1, min(batch_size, len(X_tr))), shuffle=True,
    )
    val_loader = DataLoader(
        TensorDataset(torch.tensor(X_val), torch.tensor(y_val)),
        batch_size=max(1, len(X_val)),
    )

    model     = _build_model(model_type, horizon)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=10, factor=0.5)

    best_val_loss = float("inf")
    best_state    = None
    no_improve    = 0

    for epoch in range(1, epochs + 1):
        model.train()
        for xb, yb in train_loader:
            optimizer.zero_grad()
            loss = criterion(model(xb), yb)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

        model.eval()
        with torch.no_grad():
            val_loss = float(np.mean([criterion(model(xb), yb).item() for xb, yb in val_loader]))
        scheduler.step(val_loss)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state    = {k: v.clone() for k, v in model.state_dict().items()}
            no_improve    = 0
        else:
            no_improve += 1

        if epoch % 20 == 0:
            logger.info(f"    epoch {epoch}/{epochs} val_loss={val_loss:.6f} best={best_val_loss:.6f}")

        if no_improve >= early_stopping_patience:
            logger.info(f"    Early stop @ epoch {epoch}")
            break

    model.load_state_dict(best_state)
    return model, best_val_loss, epoch


def _walk_forward_eval(
    model_type: ModelType,
    scaled: np.ndarray,
    window_size: int,
    horizon: int,
    batch_size: int,
    lr: float,
    n_test: int,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Walk-forward (time series cross-validation) pada n_test langkah terakhir.
    Setiap langkah: train pada semua data hingga bulan t, prediksi bulan t+1.
    Ini adalah evaluasi yang paling realistis untuk model 1-step-ahead.
    """
    n      = len(scaled)
    preds, actuals = [], []

    for i in range(n_test):
        train_end = n - n_test + i
        if train_end < window_size + 4:
            continue

        train_data = scaled[:train_end]
        model, _, _ = _train_single(
            model_type, train_data, window_size, horizon,
            epochs=200, batch_size=batch_size, lr=lr,
            early_stopping_patience=20,
        )

        x = torch.tensor(
            train_data[-window_size:], dtype=torch.float32
        ).unsqueeze(0).unsqueeze(-1)   # (1, W, 1)

        model.eval()
        with torch.no_grad():
            pred = float(model(x).numpy().flatten()[0])

        preds.append(pred)
        actuals.append(float(scaled[train_end]))

    return np.array(preds, dtype=np.float32), np.array(actuals, dtype=np.float32)


def _candidate_windows(n_pretrain: int) -> list[int]:
    """Kandidat window_size berdasarkan jumlah data pre-test."""
    max_w = max(3, int(n_pretrain * 0.50))
    return [w for w in [3, 6, 9, 12] if w <= max_w] or [3]


# ── Entry point ───────────────────────────────────────────────────────────────

def train(
    model_type: ModelType,
    metric: str,
    regional: str = "NASIONAL",
    witel: Optional[str] = None,
    window_size: int = 0,          # 0 = auto-tune
    horizon: int = config.HORIZON,
    epochs: int = 300,
    batch_size: int = config.BATCH_SIZE,
    lr: float = config.LEARNING_RATE,
) -> dict:
    """
    Latih GRU/LSTM dengan walk-forward validation dan model final pada semua data.

    window_size=0  → auto-tune pilih window terbaik otomatis.
    """
    reg_display = regional_display(regional)
    log_scope   = reg_display + (f" / {witel}" if witel else "")
    logger.info(f"[TRAIN] {model_type.upper()} | {metric} | {log_scope}")

    # ── 1. Ambil data ──────────────────────────────────────────────────────────
    model_path, scaler_path = _model_paths(model_type, metric, reg_display, witel)

    is_nasional = regional.upper() == "NASIONAL" and not witel
    reg_param   = None if is_nasional else regional

    df = get_series(metric, reg_param, witel)
    if is_nasional:
        df = aggregate_national(df)

    df     = df.sort_values("periode")
    n_data = len(df)
    logger.info(f"[TRAIN] {n_data} bulan data tersedia")

    # ── 2. Scale semua data (scaler fit pada semua data) ─────────────────────
    scaled, scaler = prepare_series(df, scaler_path)
    # prepare_series sudah menyimpan scaler ke disk

    # ── 3. Tentukan walk-forward test window ──────────────────────────────────
    # Gunakan min(6, ~15% data) bulan terakhir sebagai walk-forward test
    n_test    = max(3, min(6, n_data // 7))
    n_pretrain = n_data - n_test
    logger.info(f"[TRAIN] Walk-forward: {n_test} bulan terakhir sebagai test")

    min_needed = 3 + horizon + 4   # minimum absolute
    if n_data < min_needed + n_test:
        raise ValueError(f"Data terlalu sedikit: {n_data} baris (butuh min {min_needed + n_test})")

    # ── 4. Auto-tune window_size ───────────────────────────────────────────────
    auto_tuned = (window_size == 0)
    if auto_tuned:
        candidates = _candidate_windows(n_pretrain)
        logger.info(f"[AUTO-TUNE] kandidat window: {candidates}")

        best_window   = candidates[0]
        best_tune_loss = float("inf")

        for w in candidates:
            if n_pretrain < w + horizon + 4:
                logger.info(f"  Skip w={w} (pre-train data tidak cukup)")
                continue
            logger.info(f"  Mencoba window={w} ...")
            try:
                _, vl, _ = _train_single(
                    model_type, scaled[:n_pretrain], w, horizon,
                    epochs=150, batch_size=batch_size, lr=lr,
                    early_stopping_patience=20,
                )
                logger.info(f"  window={w} → val_loss={vl:.6f}")
                if vl < best_tune_loss:
                    best_tune_loss = vl
                    best_window    = w
            except Exception as e:
                logger.warning(f"  window={w} gagal: {e}")

        window_size = best_window
        logger.info(f"[AUTO-TUNE] window terpilih: {window_size}")
    else:
        if n_data < window_size + horizon + 4:
            raise ValueError(f"Data tidak cukup untuk window_size={window_size}")

    # ── 5. Walk-forward evaluation ─────────────────────────────────────────────
    logger.info(f"[TRAIN] Walk-forward eval ({n_test} langkah) ...")
    preds_scaled, actuals_scaled = _walk_forward_eval(
        model_type, scaled, window_size, horizon, batch_size, lr, n_test
    )

    # Konversi ke skala asli untuk metrics
    preds_real   = inverse_scale(preds_scaled, scaler)
    actuals_real = inverse_scale(actuals_scaled, scaler)
    y_all_real   = inverse_scale(scaled, scaler)   # semua data sebagai referensi MASE

    metrics = all_metrics(actuals_real, preds_real, y_train=y_all_real, m=12)
    logger.info(f"[TRAIN] Walk-forward metrics: {metrics}")

    kpi = metrics.get("kpi", {})
    logger.info(
        f"[TRAIN] KPI — MASE<1: {kpi.get('mase_ok','?')} | "
        f"sMAPE<15% (short): {kpi.get('smape_short_ok','?')} | "
        f"Skill>0.2: {kpi.get('skill_ok','?')}"
    )

    # ── 6. Model FINAL: training pada SEMUA data ──────────────────────────────
    logger.info(f"[TRAIN] Training model final pada semua {n_data} data ...")
    final_model, _, final_epoch = _train_single(
        model_type, scaled, window_size, horizon,
        epochs=epochs, batch_size=batch_size, lr=lr,
        early_stopping_patience=25,
    )

    # ── 7. Benchmark vs history — simpan hanya jika lebih baik ───────────────
    history_path = config.SAVED_MODELS_DIR / "training_history.json"
    _history_all = []
    if history_path.exists():
        try:
            _history_all = json.loads(history_path.read_text())
        except Exception:
            _history_all = []

    # Cari best previous run untuk kombinasi metric+regional+witel yang sama
    def _score(entry):
        m = entry.get("val_metrics", {})
        return (m.get("smape", 999), -m.get("skill_score", -999))  # (smape asc, skill desc)

    prev_best = None
    for h in _history_all:
        if (h.get("metric") == metric
                and h.get("model_type") == model_type
                and h.get("regional") == reg_display
                and h.get("witel") == witel
                and h.get("val_metrics")
                and h.get("is_best") is True):  # hanya entry yang explicitly is_best=True
            if prev_best is None or _score(h) < _score(prev_best):
                prev_best = h

    curr_smape  = metrics.get("smape", 999)
    curr_skill  = metrics.get("skill_score", -999)
    is_best     = True
    benchmark   = None

    if prev_best is not None:
        pb_smape = prev_best["val_metrics"].get("smape", 999)
        pb_skill = prev_best["val_metrics"].get("skill_score", -999)
        benchmark = {
            "prev_smape":       pb_smape,
            "prev_skill_score": pb_skill,
            "prev_trained_at":  prev_best.get("trained_at"),
        }
        # Menang jika sMAPE lebih rendah, atau sMAPE sama tapi skill lebih tinggi
        is_best = (curr_smape, -curr_skill) < (pb_smape, -pb_skill)

    if is_best:
        torch.save(
            {
                "state_dict":  final_model.state_dict(),
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
        logger.info(f"[TRAIN] ✅ Model baru LEBIH BAIK — disimpan: {model_path.name} (sMAPE {curr_smape:.2f}% vs prev {benchmark['prev_smape']:.2f}%)" if benchmark else f"[TRAIN] ✅ Model pertama disimpan: {model_path.name}")
    else:
        logger.info(f"[TRAIN] ⏭ Model lama LEBIH BAIK — tidak overwrite {model_path.name} (sMAPE {curr_smape:.2f}% vs prev best {benchmark['prev_smape']:.2f}%)")

    # ── 8. Prediksi bulan berikutnya dengan model final ───────────────────────────
    last_scaled     = scaled[-window_size:]
    x_pred          = torch.tensor(last_scaled, dtype=torch.float32).unsqueeze(0).unsqueeze(-1)
    final_model.eval()
    with torch.no_grad():
        pred_s = float(final_model(x_pred).numpy().flatten()[0])
    pred_val        = max(0.0, float(inverse_scale(np.array([pred_s]), scaler)[0]))
    raw_last_val    = float(inverse_scale(scaled[-1:], scaler)[0])

    # Deteksi partial data: jika bulan terakhir < 30% median, pakai bulan sebelumnya
    all_vals     = df["value"].values
    median_val   = float(np.median(all_vals[:-1])) if len(all_vals) > 1 else raw_last_val
    partial_data = (median_val > 0 and raw_last_val < median_val * 0.30)

    if partial_data and len(df) >= 2:
        last_actual_val = float(df["value"].iloc[-2])
        last_period     = str(df["periode"].iloc[-2])[:7]
        logger.warning(f"[TRAIN] Partial data terdeteksi (last={raw_last_val:.0f} vs median={median_val:.0f}) — referensi: {last_period}")
    else:
        last_actual_val = raw_last_val
        last_period     = str(df["periode"].iloc[-1])[:7]

    forecast_period = str(pd.Timestamp(last_period) + pd.DateOffset(months=1))[:7]
    change_pct      = round((pred_val - last_actual_val) / max(abs(last_actual_val), 1) * 100, 2)

    # ── 9. Simpan history ──────────────────────────────────────────────────────
    result = {
        "status":         "success",
        "model_type":     model_type,
        "metric":         metric,
        "regional":       reg_display,
        "witel":          witel,
        "data_points":    n_data,
        "window_size":    window_size,
        "n_test":         n_test,
        "auto_tuned":     auto_tuned,
        "epochs_run":     final_epoch,
        "eval_method":    "walk-forward",
        "last_period":    last_period,
        "last_actual":    round(last_actual_val, 2),
        "forecast_period": forecast_period,
        "prediction":     round(pred_val, 2),
        "change_pct":     change_pct,
        "val_metrics":    metrics,
        "is_best":        is_best,
        "benchmark":      benchmark,
        "model_path":     str(model_path),
        "trained_at":     datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    _history_all.append(result)
    history_path.write_text(json.dumps(_history_all, indent=2, default=str))

    return result
