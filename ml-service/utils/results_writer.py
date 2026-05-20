"""
utils/results_writer.py
Update tabel hasil evaluasi model per model type ke CSV.

Satu file CSV per model type (gru, lstm, prophet, arima).
Setiap baris = kombinasi (modul, regional, witel).
Hanya menyimpan hasil terbaik (sMAPE terendah) per kombinasi.
"""
from __future__ import annotations

import csv
import logging
from pathlib import Path
from typing import Optional

import config

logger = logging.getLogger(__name__)

RESULTS_DIR = config.SAVED_MODELS_DIR.parent / "results"

COLUMNS = [
    "modul",
    "level",
    "regional",
    "witel",
    "data_points",
    "n_test",
    "MAE",
    "RMSE",
    "MAPE",
    "sMAPE",
    "MASE",
    "Skill_vs_Naive",
    "KPI_pass",
    "trained_at",
]


def _level(regional: str, witel: Optional[str]) -> str:
    if witel:
        return "witel"
    if regional.upper() == "NASIONAL":
        return "nasional"
    return "regional"


def _csv_path(model_type: str) -> Path:
    RESULTS_DIR.mkdir(exist_ok=True)
    return RESULTS_DIR / f"tabel_{model_type}.csv"


def _read_csv(path: Path) -> list[dict]:
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _write_csv(path: Path, rows: list[dict]) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows)


def update_results(
    model_type: str,
    metric: str,
    regional: str,
    witel: Optional[str],
    val_metrics: dict,
    data_points: int,
    n_test: int,
    trained_at: str,
) -> None:
    """
    Upsert satu baris ke tabel hasil model_type.
    Hanya update jika sMAPE baru lebih rendah dari yang tersimpan.
    """
    path  = _csv_path(model_type)
    rows  = _read_csv(path)

    new_smape = val_metrics.get("smape", 999)
    level     = _level(regional, witel)
    witel_val = witel or "-"

    new_row = {
        "modul":          metric,
        "level":          level,
        "regional":       regional,
        "witel":          witel_val,
        "data_points":    data_points,
        "n_test":         n_test,
        "MAE":            round(val_metrics.get("mae", 0), 4),
        "RMSE":           round(val_metrics.get("rmse", 0), 4),
        "MAPE":           round(val_metrics.get("mape", 0), 4),
        "sMAPE":          round(new_smape, 4),
        "MASE":           round(val_metrics.get("mase", 0), 4),
        "Skill_vs_Naive": round(val_metrics.get("skill_score", 0), 4),
        "KPI_pass":       new_smape < 30.0 and val_metrics.get("skill_score", -999) > -0.1,
        "trained_at":     trained_at,
    }

    # Cari baris yang sudah ada untuk kombinasi ini
    key = (metric, regional, witel_val)
    updated = False
    for i, row in enumerate(rows):
        if (row["modul"], row["regional"], row["witel"]) == key:
            existing_smape = float(row.get("sMAPE", 999))
            if new_smape <= existing_smape:
                rows[i] = new_row
                updated = True
            else:
                logger.info(
                    f"[RESULTS] {model_type.upper()} {metric} {regional} — "
                    f"hasil lama lebih baik (sMAPE {existing_smape:.2f}% vs {new_smape:.2f}%), tidak diupdate"
                )
                return
            break

    if not updated:
        rows.append(new_row)

    # Sort: modul → level (nasional < regional < witel) → regional → witel
    level_order = {"nasional": 0, "regional": 1, "witel": 2}
    rows.sort(key=lambda r: (r["modul"], level_order.get(r["level"], 9), r["regional"], r["witel"]))

    _write_csv(path, rows)
    logger.info(f"[RESULTS] Tabel diupdate: {path.name} — {metric} | {regional} | {witel_val} | sMAPE={new_smape:.2f}%")
