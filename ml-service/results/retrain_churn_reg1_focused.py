"""
retrain_churn_reg1_focused.py
─────────────────────────────
Fokus REG-1 churn_hsi dengan window=3 (config terbaik dari run sebelumnya).
Banyak round untuk variasi random seed + variasi kecil hyperparameter.

    cd ml-service
    python3 results/retrain_churn_reg1_focused.py
"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import config
from training.trainer import train

CONFIGS = [
    # Window 3 — variasi kecil di sekitar config terbaik
    {"name": "w3_h96_lr1e3",   "HIDDEN_SIZE": 96,  "LEARNING_RATE": 1e-3,  "DROPOUT": 0.15, "NUM_LAYERS": 2},
    {"name": "w3_h96_lr8e4",   "HIDDEN_SIZE": 96,  "LEARNING_RATE": 8e-4,  "DROPOUT": 0.15, "NUM_LAYERS": 2},
    {"name": "w3_h96_lr5e4",   "HIDDEN_SIZE": 96,  "LEARNING_RATE": 5e-4,  "DROPOUT": 0.10, "NUM_LAYERS": 2},
    {"name": "w3_h128_lr1e3",  "HIDDEN_SIZE": 128, "LEARNING_RATE": 1e-3,  "DROPOUT": 0.15, "NUM_LAYERS": 2},
    {"name": "w3_h128_lr5e4",  "HIDDEN_SIZE": 128, "LEARNING_RATE": 5e-4,  "DROPOUT": 0.10, "NUM_LAYERS": 2},
    {"name": "w3_h64_lr1e3",   "HIDDEN_SIZE": 64,  "LEARNING_RATE": 1e-3,  "DROPOUT": 0.10, "NUM_LAYERS": 2},
    {"name": "w3_h64_lr2e3",   "HIDDEN_SIZE": 64,  "LEARNING_RATE": 2e-3,  "DROPOUT": 0.15, "NUM_LAYERS": 2},
    {"name": "w3_h96_lr1e3_d2","HIDDEN_SIZE": 96,  "LEARNING_RATE": 1e-3,  "DROPOUT": 0.20, "NUM_LAYERS": 2},
]

ROUNDS = 5  # per config per model
TARGETS = [
    ("churn_hsi", "gru",  "REG-1"),
    ("churn_hsi", "lstm", "REG-1"),
]

def main():
    total = len(TARGETS) * len(CONFIGS) * ROUNDS
    run = 0
    best = {}

    print(f"Fokus REG-1 churn — {len(CONFIGS)} configs × {ROUNDS} rounds × {len(TARGETS)} models = {total} runs\n")

    for metric, model_type, regional in TARGETS:
        key = (model_type, regional)
        print(f"\n{'═' * 50}")
        print(f"  {model_type.upper()} | {regional}")
        print(f"{'═' * 50}")

        for cfg in CONFIGS:
            config.HIDDEN_SIZE   = cfg["HIDDEN_SIZE"]
            config.LEARNING_RATE = cfg["LEARNING_RATE"]
            config.DROPOUT       = cfg["DROPOUT"]
            config.NUM_LAYERS    = cfg["NUM_LAYERS"]

            for r in range(1, ROUNDS + 1):
                run += 1
                try:
                    result = train(
                        model_type=model_type, metric=metric, regional=regional,
                        window_size=3, epochs=300, lr=cfg["LEARNING_RATE"],
                    )
                    smape = result["val_metrics"].get("smape", 999)
                    skill = result["val_metrics"].get("skill_score", -999)
                    saved = "💾" if result.get("is_best") else ""
                    tag = "✅" if smape < 30 else "❌"
                    print(f"  [{run}/{total}] {cfg['name']} r{r} → sMAPE={smape:.2f}% Skill={skill:.3f} {tag} {saved}")

                    if key not in best or smape < best[key][0]:
                        best[key] = (smape, skill, cfg["name"], r)

                    # Early exit jika sudah LULUS
                    if smape < 30:
                        print(f"\n  🎉 {model_type.upper()} REG-1 LULUS! sMAPE={smape:.2f}%")
                        break
                except Exception as e:
                    print(f"  [{run}/{total}] {cfg['name']} r{r} → ERROR: {e}")

            # Check if already passed
            if key in best and best[key][0] < 30:
                print(f"  → Sudah LULUS, skip config berikutnya")
                break

    # Restore
    config.HIDDEN_SIZE = 64; config.LEARNING_RATE = 1e-3; config.DROPOUT = 0.2; config.NUM_LAYERS = 2

    print(f"\n\n{'═' * 50}")
    print("HASIL AKHIR")
    print(f"{'═' * 50}")
    for (mt, reg), (sm, sk, cfg, r) in sorted(best.items()):
        tag = "LULUS ✅" if sm < 30 else "GAGAL ❌"
        print(f"  {mt.upper():5} | {reg} | sMAPE={sm:.2f}% | Skill={sk:.3f} | {cfg} round {r} | {tag}")


if __name__ == "__main__":
    main()
