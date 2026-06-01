"""
Retrain semua kombinasi yang KPI_pass=False dari tabel hasil CSV.
Berlaku untuk semua model: GRU, LSTM, Prophet, ARIMA.

Jalankan dari direktori ml-service/:
    python results/retrain_kpi_failed.py
"""
import csv
import sys
import logging
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

logging.basicConfig(level=logging.WARNING, format="%(message)s")
logging.getLogger("data.fetcher").setLevel(logging.ERROR)

RESULTS_DIR = Path(__file__).parent
MODELS      = ["gru", "lstm", "prophet", "arima"]


def load_kpi_failed() -> list[dict]:
    """Baca semua CSV, kumpulkan baris dengan KPI_pass=False. Deduplicate by uppercase key."""
    seen = set()
    jobs = []
    for model_type in MODELS:
        path = RESULTS_DIR / f"tabel_{model_type}.csv"
        if not path.exists():
            continue
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["KPI_pass"] == "False":
                    witel = row["witel"].upper() if row["witel"] != "-" else None
                    key   = (model_type, row["modul"], row["regional"], witel or "-")
                    if key in seen:
                        continue
                    seen.add(key)
                    jobs.append({
                        "model_type": model_type,
                        "metric":     row["modul"],
                        "regional":   row["regional"],
                        "witel":      witel,
                        "smape_prev": float(row["sMAPE"]),
                    })
    return jobs


def run_one(metric, model_type, regional, witel=None):
    try:
        if model_type == "prophet":
            from training.prophet_trainer import train_prophet
            result = train_prophet(metric=metric, regional=regional, witel=witel)
        elif model_type == "arima":
            from training.arima_trainer import train_arima
            result = train_arima(metric=metric, regional=regional, witel=witel)
        else:
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
        return True, vm.get("smape", 999), vm.get("skill_score", -999)
    except Exception as e:
        return False, None, str(e)


def main():
    jobs = load_kpi_failed()

    if not jobs:
        print("Semua model sudah meet KPI!")
        return

    print(f"\n{'='*65}")
    print(f"  Retrain KPI-Failed Models")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"  Total: {len(jobs)} kombinasi yang KPI_pass=False")
    print(f"{'='*65}\n")

    improved, same, failed = 0, 0, 0
    failures = []

    for i, job in enumerate(jobs, 1):
        metric    = job["metric"]
        model_type= job["model_type"]
        regional  = job["regional"]
        witel     = job["witel"]
        smape_prev= job["smape_prev"]

        loc   = regional + (f"/{witel}" if witel else "")
        label = f"[{i:2}/{len(jobs)}] {model_type.upper():8} | {metric:20} | {loc}"

        print(f"{label}  →  training...", end="", flush=True)
        t_start = datetime.now()

        ok, smape_new, extra = run_one(metric, model_type, regional, witel)
        elapsed = round((datetime.now() - t_start).total_seconds())

        if ok:
            kpi_now = smape_new < 30.0 and extra > -0.1
            delta   = smape_prev - smape_new
            status  = "✅ KPI MET" if kpi_now else ("↓ improved" if delta > 0 else "↔ no change")
            print(f"  {status}  sMAPE {smape_prev:.1f}%→{smape_new:.1f}%  ({elapsed}s)")
            if kpi_now or delta > 0:
                improved += 1
            else:
                same += 1
        else:
            print(f"  ✗  {extra}")
            failures.append({
                "metric": metric, "model": model_type,
                "regional": regional, "witel": witel or "-",
                "smape_prev": smape_prev, "error": str(extra),
            })
            failed += 1

    print(f"\n{'='*65}")
    print(f"  Selesai: {improved} improved/met KPI | {same} no change | {failed} error")
    print(f"{'='*65}\n")

    if failures:
        log_path = RESULTS_DIR / "retrain_failed.csv"
        with open(log_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["metric", "model", "regional", "witel", "smape_prev", "error"])
            writer.writeheader()
            writer.writerows(failures)
        print(f"  Error log: results/retrain_failed.csv\n")


if __name__ == "__main__":
    main()
