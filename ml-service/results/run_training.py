"""
Training otomatis internal — tanpa server, tanpa API.
Langsung panggil trainer functions, sequential, hasil otomatis masuk CSV.

Jalankan dari direktori ml-service/:
    python results/run_training.py

Edit bagian SCOPE di bawah untuk atur metric, regional, dan model yang mau ditraining.
"""
import sys
import json
import logging
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

# Setup logging
logging.basicConfig(
    level=logging.WARNING,
    format="%(message)s",
)
# Suppress Oracle Thin mode fallback warning
logging.getLogger("data.fetcher").setLevel(logging.ERROR)
logger = logging.getLogger(__name__)

import config

# ─── SCOPE: edit sesuai kebutuhan ──────────────────────────────────────────────

METRICS         = ["realisasi_hsi"]                                           # metric yang mau ditraining
REGIONALS       = ["NASIONAL", "REG-1", "REG-2", "REG-3", "REG-4", "REG-5"]  # level regional
MODELS          = ["gru", "lstm", "prophet", "arima"]                     # model yang mau ditraining
INCLUDE_WITEL   = True    # True = auto-discover & train semua witel tiap regional
                          # False = skip witel, nasional + regional saja

# ──────────────────────────────────────────────────────────────────────────────


def get_witels_for(metric, regional):
    """Ambil daftar witel dari DB untuk metric + regional tertentu."""
    try:
        from data.fetcher import get_witels
        return get_witels(metric, regional)
    except Exception as e:
        print(f"    [WARN] Gagal fetch witels {metric}/{regional}: {e}")
        return []


def already_trained(metric, model_type, regional, witel=None):
    """Cek apakah kombinasi ini sudah sukses di training_history."""
    history_path = config.SAVED_MODELS_DIR / "training_history.json"
    if not history_path.exists():
        return False
    history = json.loads(history_path.read_text())
    for h in history:
        if (h.get("status") == "success"
                and h.get("model_type") == model_type
                and h.get("metric") == metric
                and h.get("regional") == regional
                and (h.get("witel") or None) == (witel or None)):
            return True
    return False


def run_one(metric, model_type, regional, witel=None):
    try:
        if model_type == "prophet":
            from training.prophet_trainer import train_prophet
            result = train_prophet(metric=metric, regional=regional, witel=witel)

        elif model_type == "arima":
            from training.arima_trainer import train_arima
            result = train_arima(metric=metric, regional=regional, witel=witel)

        else:  # gru / lstm
            from training.trainer import train
            result = train(
                model_type=model_type,
                metric=metric,
                regional=regional,
                witel=witel,
                epochs=300,
                window_size=0,
            )

        vm = result.get("val_metrics", {})
        return True, vm.get("smape", 999), vm.get("mase", 999)

    except Exception as e:
        return False, None, str(e)


def main():
    # Buat daftar semua job
    jobs = []
    for metric in METRICS:
        for regional in REGIONALS:
            # Nasional + regional
            for model_type in MODELS:
                jobs.append((metric, model_type, regional, None))

            # Witel (hanya untuk regional, bukan NASIONAL)
            if INCLUDE_WITEL and regional != "NASIONAL":
                print(f"  Mencari witel untuk {metric} / {regional}...", end=" ", flush=True)
                witels = get_witels_for(metric, regional)
                print(f"{len(witels)} witel ditemukan")
                for witel in witels:
                    for model_type in MODELS:
                        jobs.append((metric, model_type, regional, witel))

    total    = len(jobs)
    done     = 0
    skipped  = 0
    failed   = 0
    failures = []  # simpan detail kegagalan

    print(f"\n{'='*60}")
    print(f"  BrightAI — Batch Training Internal")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Total jobs: {total}")
    print(f"{'='*60}\n")

    for i, (metric, model_type, regional, witel) in enumerate(jobs, 1):
        loc = regional + (f"/{witel}" if witel else "")
        label = f"[{i:2}/{total}] {model_type.upper():8} | {metric:20} | {loc}"

        if already_trained(metric, model_type, regional, witel):
            print(f"{label}  →  skip (sudah ada)")
            skipped += 1
            continue

        print(f"{label}  →  training...", end="", flush=True)
        t_start = datetime.now()

        ok, smape, extra = run_one(metric, model_type, regional, witel)

        elapsed = round((datetime.now() - t_start).total_seconds())

        if ok:
            print(f"  ✓  sMAPE={smape:.2f}%  ({elapsed}s)")
            done += 1
        else:
            print(f"  ✗  {extra}")
            failures.append({"metric": metric, "model": model_type, "regional": regional, "witel": witel or "-", "error": str(extra)})
            failed += 1

    print(f"\n{'='*60}")
    print(f"  Selesai: {done} berhasil | {skipped} diskip | {failed} gagal")
    print(f"  Hasil tersimpan di: ml-service/results/")
    print(f"{'='*60}\n")

    # Tulis log kegagalan
    if failures:
        import csv
        log_path = Path(__file__).parent / "failed_jobs.csv"
        with open(log_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["metric", "model", "regional", "witel", "error"])
            writer.writeheader()
            writer.writerows(failures)
        print(f"  Detail kegagalan: results/failed_jobs.csv\n")


if __name__ == "__main__":
    main()
