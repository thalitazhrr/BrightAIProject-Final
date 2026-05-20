"""
Script sekali jalan: generate tabel CSV dari training_history.json yang sudah ada.
Jalankan dari direktori ml-service/:
    python results/generate_from_history.py
"""
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from utils.results_writer import update_results, RESULTS_DIR, COLUMNS

# Hapus CSV lama dulu supaya bersih
for f in RESULTS_DIR.glob("tabel_*.csv"):
    f.unlink()
    print(f"Hapus {f.name}")

history_path = config.SAVED_MODELS_DIR / "training_history.json"
if not history_path.exists():
    print("training_history.json tidak ditemukan.")
    sys.exit(1)

history = json.loads(history_path.read_text())

# Hanya ambil yang sukses dan punya val_metrics
success = [
    h for h in history
    if h.get("status") == "success"
    and h.get("val_metrics")
    and h.get("n_test")  # skip entry lama yang n_test=0/None
]

count = 0
for entry in success:
    try:
        update_results(
            model_type=entry["model_type"],
            metric=entry["metric"],
            regional=entry["regional"],
            witel=entry.get("witel"),
            val_metrics=entry["val_metrics"],
            data_points=entry.get("data_points", 0),
            n_test=entry.get("n_test", 0),
            trained_at=entry.get("trained_at", ""),
        )
        count += 1
    except Exception as e:
        print(f"Skip {entry.get('model_type')} {entry.get('metric')}: {e}")

print(f"Selesai. {count} entry diproses dari {len(history)} total history.")
