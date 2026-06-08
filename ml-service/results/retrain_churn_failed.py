"""
retrain_churn_failed.py
───────────────────────
Re-train model churn_hsi pada REG-1 dan REG-5 yang semua model GAGAL.
Mencoba berbagai kombinasi hyperparameter untuk mendapatkan sMAPE < 30%.

Jalankan dari direktori ml-service:
    cd ml-service
    python results/retrain_churn_failed.py

Opsi:
    --dry-run       Lihat konfigurasi tanpa training
    --reg REG-5     Hanya regional tertentu
    --rounds 5      Jumlah round per konfigurasi (default: 3)
"""
import argparse
import sys
import json
import time
from pathlib import Path

# Tambahkan parent dir ke path agar bisa import dari ml-service
sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from training.trainer import train


# ── Target yang gagal ────────────────────────────────────────────────────────
FAILED_TARGETS = [
    # (metric, model_type, regional) — fokus GRU yang paling dekat threshold
    ("churn_hsi", "gru",  "REG-5"),   # sMAPE 30.33% — gap 0.33%
    ("churn_hsi", "gru",  "REG-1"),   # sMAPE 34.07% — gap 4.07%
    ("churn_hsi", "lstm", "REG-5"),   # sMAPE 32.97% — gap 2.97%
    ("churn_hsi", "lstm", "REG-1"),   # sMAPE 34.19% — gap 4.19%
]

# ── Konfigurasi hyperparameter yang akan dicoba ──────────────────────────────
# SEMUA pakai explicit window_size (TANPA auto-tune) agar cepat.
# Auto-tune menambah ~4x waktu per run karena training 4 model ekstra.
HYPERPARAM_CONFIGS = [
    # Config 0: Window 6 — pendek, adaptif untuk data volatil
    {
        "name": "w6_default",
        "HIDDEN_SIZE": 64,
        "LEARNING_RATE": 1e-3,
        "DROPOUT": 0.2,
        "NUM_LAYERS": 2,
        "window_size": 6,
        "epochs": 300,
    },
    # Config 1: Window 6 + larger hidden + lower LR
    {
        "name": "w6_large_stable",
        "HIDDEN_SIZE": 96,
        "LEARNING_RATE": 5e-4,
        "DROPOUT": 0.15,
        "NUM_LAYERS": 2,
        "window_size": 6,
        "epochs": 300,
    },
    # Config 2: Window 3 — sangat reaktif
    {
        "name": "w3_reactive",
        "HIDDEN_SIZE": 96,
        "LEARNING_RATE": 1e-3,
        "DROPOUT": 0.15,
        "NUM_LAYERS": 2,
        "window_size": 3,
        "epochs": 300,
    },
    # Config 3: Window 9 + larger hidden
    {
        "name": "w9_large",
        "HIDDEN_SIZE": 96,
        "LEARNING_RATE": 7e-4,
        "DROPOUT": 0.15,
        "NUM_LAYERS": 2,
        "window_size": 9,
        "epochs": 300,
    },
    # Config 4: Window 12 (default) + large hidden
    {
        "name": "w12_large",
        "HIDDEN_SIZE": 128,
        "LEARNING_RATE": 5e-4,
        "DROPOUT": 0.2,
        "NUM_LAYERS": 2,
        "window_size": 12,
        "epochs": 300,
    },
]


def apply_config(cfg: dict):
    """Override config.py values at runtime."""
    config.HIDDEN_SIZE   = cfg["HIDDEN_SIZE"]
    config.LEARNING_RATE = cfg["LEARNING_RATE"]
    config.DROPOUT       = cfg["DROPOUT"]
    config.NUM_LAYERS    = cfg["NUM_LAYERS"]


def restore_defaults():
    """Kembalikan ke default."""
    config.HIDDEN_SIZE   = 64
    config.LEARNING_RATE = 1e-3
    config.DROPOUT       = 0.2
    config.NUM_LAYERS    = 2


def main():
    parser = argparse.ArgumentParser(description="Re-train churn_hsi yang GAGAL")
    parser.add_argument("--dry-run", action="store_true", help="Tampilkan konfigurasi saja")
    parser.add_argument("--reg", type=str, default=None, help="Hanya regional tertentu (e.g. REG-5)")
    parser.add_argument("--rounds", type=int, default=3, help="Jumlah round per konfigurasi (variasi random seed)")
    args = parser.parse_args()

    targets = FAILED_TARGETS
    if args.reg:
        targets = [(m, mt, r) for m, mt, r in targets if r == args.reg]

    if not targets:
        print(f"Tidak ada target untuk --reg={args.reg}")
        return

    print("=" * 70)
    print("RE-TRAINING CHURN_HSI — REGIONAL YANG GAGAL")
    print("=" * 70)
    print(f"\nTarget: {len(targets)} kombinasi model × regional")
    for metric, model_type, regional in targets:
        print(f"  • {model_type.upper():5} | {metric} | {regional}")
    print(f"\nKonfigurasi hyperparameter: {len(HYPERPARAM_CONFIGS)} variasi")
    for i, cfg in enumerate(HYPERPARAM_CONFIGS):
        print(f"  [{i}] {cfg['name']:20} | hidden={cfg['HIDDEN_SIZE']} lr={cfg['LEARNING_RATE']:.0e} "
              f"drop={cfg['DROPOUT']} layers={cfg['NUM_LAYERS']} window={cfg['window_size'] or 'auto'} "
              f"epochs={cfg['epochs']}")
    print(f"\nRounds per konfigurasi: {args.rounds}")
    total_runs = len(targets) * len(HYPERPARAM_CONFIGS) * args.rounds
    print(f"Total training runs: {total_runs}")

    if args.dry_run:
        print("\n[dry-run] Tidak ada training yang dijalankan.")
        return

    print(f"\nMulai training...\n")

    # Track results
    results = []  # list of dicts
    best_per_target = {}  # (model_type, regional) → best sMAPE

    run_num = 0
    for metric, model_type, regional in targets:
        target_key = (model_type, regional)
        print(f"\n{'─' * 60}")
        print(f"TARGET: {model_type.upper()} | {metric} | {regional}")
        print(f"{'─' * 60}")

        for cfg_idx, cfg in enumerate(HYPERPARAM_CONFIGS):
            apply_config(cfg)

            for round_num in range(1, args.rounds + 1):
                run_num += 1
                print(f"\n[Run {run_num}/{total_runs}] "
                      f"{model_type.upper()} | {regional} | "
                      f"config={cfg['name']} | round={round_num}/{args.rounds}")

                try:
                    result = train(
                        model_type=model_type,
                        metric=metric,
                        regional=regional,
                        window_size=cfg["window_size"],
                        epochs=cfg["epochs"],
                        lr=cfg["LEARNING_RATE"],
                    )

                    smape = result["val_metrics"].get("smape", 999)
                    skill = result["val_metrics"].get("skill_score", -999)
                    kpi_status = result["val_metrics"].get("kpi_status", "?")
                    is_best = result.get("is_best", False)

                    entry = {
                        "model_type": model_type,
                        "regional": regional,
                        "config": cfg["name"],
                        "round": round_num,
                        "smape": smape,
                        "skill_score": skill,
                        "kpi_status": kpi_status,
                        "is_best": is_best,
                        "window_size": result.get("window_size"),
                    }
                    results.append(entry)

                    passed = "✅ LULUS" if smape < 30 else ("⚠️ LDC" if smape < 30 and skill > -0.5 else "❌ GAGAL")
                    saved  = "💾 SAVED" if is_best else ""
                    print(f"  → sMAPE={smape:.2f}% | Skill={skill:.3f} | {passed} {saved}")

                    # Track best
                    if target_key not in best_per_target or smape < best_per_target[target_key]["smape"]:
                        best_per_target[target_key] = entry

                except Exception as e:
                    print(f"  → ERROR: {e}")
                    results.append({
                        "model_type": model_type,
                        "regional": regional,
                        "config": cfg["name"],
                        "round": round_num,
                        "error": str(e),
                    })

        restore_defaults()

    # ── Summary ──────────────────────────────────────────────────────────────
    print(f"\n\n{'=' * 70}")
    print("RINGKASAN HASIL")
    print(f"{'=' * 70}\n")

    for (model_type, regional), best in sorted(best_per_target.items()):
        smape = best["smape"]
        status = "LULUS ✅" if smape < 30 else "GAGAL ❌"
        print(f"  {model_type.upper():5} | {regional} | Best sMAPE: {smape:.2f}% | "
              f"Skill: {best['skill_score']:.3f} | Config: {best['config']} | "
              f"Window: {best.get('window_size', '?')} | {status}")

    # sMAPE < 30% count
    passed = [r for r in results if r.get("smape", 999) < 30]
    print(f"\nTotal runs dengan sMAPE < 30%: {len(passed)} / {len(results)}")

    if passed:
        print("\nRun yang LULUS:")
        for r in sorted(passed, key=lambda x: x["smape"]):
            print(f"  {r['model_type'].upper():5} | {r['regional']} | "
                  f"sMAPE={r['smape']:.2f}% | Config={r['config']} | "
                  f"Window={r.get('window_size', '?')}")

    # Save results to JSON
    out_path = Path(__file__).parent / "retrain_churn_results.json"
    out_path.write_text(json.dumps(results, indent=2, default=str))
    print(f"\nHasil lengkap disimpan di: {out_path}")


if __name__ == "__main__":
    main()
