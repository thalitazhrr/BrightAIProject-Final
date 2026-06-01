"""
Train semua kombinasi metric + model + regional + witel yang belum ada.
Auto-discover witel dari API, skip yang sudah sukses di history.

Jalankan saat ML service sedang berjalan (port 8000):
    python results/train_all_missing.py

Opsi:
    python results/train_all_missing.py --dry-run   # lihat daftar tanpa train
    python results/train_all_missing.py --nasional  # nasional saja
    python results/train_all_missing.py --no-witel  # nasional + regional saja
"""
import argparse
import json
import time
import sys
from pathlib import Path

import requests

BASE = "http://localhost:8000/forecast"

METRICS = [
    "order_hsi",
    "revenue_hsi",
    "churn_hsi",
    "realisasi_hsi",
    "fulfillment_rate",
    "recurring_revenue",
    "avg_install_days",
]

REGIONALS = ["NASIONAL", "REG-1", "REG-2", "REG-3", "REG-4", "REG-5"]

# Model utama per metric (sesuai rekomendasi TA)
MAIN_MODELS = {
    "order_hsi":        ["gru", "lstm", "prophet", "arima"],
    "revenue_hsi":      ["gru", "lstm", "prophet", "arima"],
    "churn_hsi":        ["gru", "lstm", "prophet", "arima"],
    "realisasi_hsi":    ["gru", "lstm", "prophet", "arima"],
    "fulfillment_rate": ["gru", "lstm", "prophet", "arima"],
    "recurring_revenue":["gru", "lstm", "prophet", "arima"],
    "avg_install_days": ["gru", "lstm", "prophet", "arima"],
}


def get_witels(metric, regional):
    try:
        r = requests.get(f"{BASE}/witels", params={"metric": metric, "regional": regional}, timeout=15)
        return r.json().get("witels", [])
    except Exception as e:
        print(f"    [WARN] Gagal fetch witels {metric}/{regional}: {e}")
        return []


def load_trained_set():
    """Baca training_history.json dan kembalikan set kombinasi yang sudah sukses."""
    history_path = Path(__file__).parent.parent / "saved_models" / "training_history.json"
    if not history_path.exists():
        return set()
    history = json.loads(history_path.read_text())
    trained = set()
    for h in history:
        if h.get("status") == "success":
            witel = h.get("witel") or "-"
            trained.add((h["model_type"], h["metric"], h["regional"], witel))
    return trained


def trigger_train(metric, model_type, regional, witel=None):
    payload = {
        "metric":      metric,
        "model_type":  model_type,
        "regional":    regional,
        "epochs":      300,
        "window_size": 0,
    }
    if witel:
        payload["witel"] = witel
    try:
        r = requests.post(f"{BASE}/train", json=payload, timeout=10)
        return r.status_code == 200
    except Exception as e:
        print(f"    ERROR: {e}")
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run",   action="store_true", help="Tampilkan daftar tanpa train")
    parser.add_argument("--nasional",  action="store_true", help="Hanya level NASIONAL")
    parser.add_argument("--no-witel",  action="store_true", help="Nasional + regional saja, skip witel")
    args = parser.parse_args()

    trained = load_trained_set()
    print(f"History: {len(trained)} kombinasi sudah sukses.\n")

    jobs = []  # list of (metric, model_type, regional, witel)

    scope_regionals = ["NASIONAL"] if args.nasional else REGIONALS

    for metric in METRICS:
        models = MAIN_MODELS[metric]
        for regional in scope_regionals:
            # Level nasional / regional
            for model_type in models:
                witel_key = "-"
                if (model_type, metric, regional, witel_key) not in trained:
                    jobs.append((metric, model_type, regional, None))

            # Level witel
            if not args.nasional and not args.no_witel and regional != "NASIONAL":
                witels = get_witels(metric, regional)
                for witel in witels:
                    for model_type in models:
                        if (model_type, metric, regional, witel) not in trained:
                            jobs.append((metric, model_type, regional, witel))

    if not jobs:
        print("Semua kombinasi sudah ditraining!")
        return

    print(f"Total {len(jobs)} job yang perlu ditraining:\n")
    for metric, model_type, regional, witel in jobs:
        loc = f"{regional}" + (f" / {witel}" if witel else "")
        print(f"  {model_type.upper():8} | {metric:20} | {loc}")

    if args.dry_run:
        print("\n[dry-run] Tidak ada training yang dijalankan.")
        return

    print(f"\nMulai training {len(jobs)} jobs...\n")
    success, fail = 0, 0

    for i, (metric, model_type, regional, witel) in enumerate(jobs, 1):
        loc = f"{regional}" + (f" / {witel}" if witel else "")
        print(f"[{i}/{len(jobs)}] {model_type.upper()} | {metric} | {loc}")
        ok = trigger_train(metric, model_type, regional, witel)
        if ok:
            success += 1
            print(f"    ✓ Job dikirim")
        else:
            fail += 1
        # Jeda antar job agar tidak overwhelming background queue
        time.sleep(5)

    print(f"\nSelesai: {success} job dikirim, {fail} gagal.")
    print("Training berjalan di background. Pantau log ML service.")
    print("CSV di results/ otomatis terupdate setelah tiap model selesai.")


if __name__ == "__main__":
    main()
