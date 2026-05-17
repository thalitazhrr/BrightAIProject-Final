"""
evaluation/nlg_eval.py
======================
Evaluasi kualitas Natural Language Generation (NLG) BrightAI
menggunakan tiga metrik standar:
  - BLEU Score   : mengukur n-gram precision vs reference
  - ROUGE Score  : mengukur recall n-gram & sequence terpanjang
  - BERTScore    : mengukur kemiripan semantik menggunakan BERT

Cara pakai:
  pip install nltk rouge-score bert-score torch transformers
  python nlg_eval.py

Output:
  - Tabel per test case di terminal
  - File results/nlg_evaluation_results.json
  - File results/nlg_evaluation_summary.json
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# ── Dependency check ──────────────────────────────────────────────────────────
def check_dependencies():
    missing = []
    try:
        import nltk
    except ImportError:
        missing.append("nltk")
    try:
        from rouge_score import rouge_scorer
    except ImportError:
        missing.append("rouge-score")
    try:
        import bert_score
    except ImportError:
        missing.append("bert-score")

    if missing:
        print("❌ Library berikut belum terinstall:")
        for m in missing:
            print(f"   pip install {m}")
        sys.exit(1)

check_dependencies()

import nltk
from nltk.translate.bleu_score import sentence_bleu, SmoothingFunction
from nltk.tokenize import word_tokenize
from rouge_score import rouge_scorer as rouge_lib
from bert_score import score as bert_score_fn

# Download NLTK data jika belum ada
for pkg in ["punkt", "punkt_tab"]:
    try:
        nltk.data.find(f"tokenizers/{pkg}")
    except LookupError:
        nltk.download(pkg, quiet=True)

# ── Path setup ────────────────────────────────────────────────────────────────
EVAL_DIR     = Path(__file__).parent
RESULTS_DIR  = EVAL_DIR / "results"
TEST_CASES   = EVAL_DIR / "test_cases.json"
RESULTS_DIR.mkdir(exist_ok=True)

# Tambahkan backend ke path agar bisa import NLG
BACKEND_DIR = EVAL_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))


# ── NLG caller ────────────────────────────────────────────────────────────────
def call_nlg(query: str) -> str:
    """
    Panggil NLG BrightAI via backend API atau langsung via modul.
    Saat ini menggunakan HTTP call ke backend lokal.
    Ganti BASE_URL jika port berbeda.
    """
    import urllib.request
    import urllib.error

    BASE_URL = "http://localhost:3001"
    payload  = json.dumps({"message": query, "sessionId": "eval-session"}).encode()

    try:
        req = urllib.request.Request(
            f"{BASE_URL}/chat/message",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            return data.get("response", "")
    except urllib.error.URLError as e:
        return f"[ERROR: Backend tidak dapat diakses — {e}]"
    except Exception as e:
        return f"[ERROR: {e}]"


# ── Metrik ────────────────────────────────────────────────────────────────────
def compute_bleu(hypothesis: str, reference: str) -> dict:
    """BLEU-1 sampai BLEU-4 dengan smoothing."""
    smoother = SmoothingFunction().method1
    hyp_tok  = word_tokenize(hypothesis.lower())
    ref_tok  = [word_tokenize(reference.lower())]

    scores = {}
    for n in range(1, 5):
        weights = tuple([1.0 / n] * n + [0.0] * (4 - n))
        try:
            scores[f"bleu_{n}"] = round(
                sentence_bleu(ref_tok, hyp_tok, weights=weights, smoothing_function=smoother), 4
            )
        except Exception:
            scores[f"bleu_{n}"] = 0.0

    return scores


def compute_rouge(hypothesis: str, reference: str) -> dict:
    """ROUGE-1, ROUGE-2, ROUGE-L (F-measure)."""
    scorer = rouge_lib.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=False)
    result = scorer.score(reference, hypothesis)
    return {
        "rouge_1":  round(result["rouge1"].fmeasure, 4),
        "rouge_2":  round(result["rouge2"].fmeasure, 4),
        "rouge_l":  round(result["rougeL"].fmeasure, 4),
    }


def compute_bertscore(hypotheses: list[str], references: list[str]) -> list[dict]:
    """
    BERTScore untuk list pasangan teks sekaligus (lebih efisien).
    Menggunakan model multilingual untuk mendukung teks Indonesia.
    """
    print("\n⏳ Menghitung BERTScore (membutuhkan waktu beberapa menit)...")
    P, R, F = bert_score_fn(
        hypotheses,
        references,
        lang="id",                        # Indonesian
        model_type="bert-base-multilingual-cased",
        verbose=False,
    )
    results = []
    for p, r, f in zip(P.tolist(), R.tolist(), F.tolist()):
        results.append({
            "bertscore_precision": round(p, 4),
            "bertscore_recall":    round(r, 4),
            "bertscore_f1":        round(f, 4),
        })
    return results


# ── Evaluasi utama ─────────────────────────────────────────────────────────────
def run_evaluation(use_mock: bool = False):
    """
    Jalankan evaluasi lengkap terhadap semua test case.

    Args:
        use_mock: Jika True, gunakan generated text dari mock
                  (untuk testing tanpa backend aktif).
    """
    print("=" * 65)
    print("  BrightAI NLG Evaluation")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 65)

    # Load test cases
    with open(TEST_CASES, encoding="utf-8") as f:
        test_cases = json.load(f)

    print(f"\n📋 Total test case: {len(test_cases)}\n")

    results      = []
    hypotheses   = []
    references   = []
    failed_cases = []

    # ── Step 1: Generate semua output NLG ────────────────────────────────────
    print("🔄 Generating NLG responses...")
    for tc in test_cases:
        tc_id  = tc["id"]
        query  = tc["query"]
        ref    = tc["reference"]

        print(f"   [{tc_id}] {query[:55]}...")

        if use_mock:
            generated = _mock_generate(tc)
        else:
            generated = call_nlg(query)

        if generated.startswith("[ERROR"):
            print(f"   ⚠️  {generated}")
            failed_cases.append(tc_id)
            generated = ""

        hypotheses.append(generated)
        references.append(ref)

        results.append({
            "id":        tc_id,
            "rule_id":   tc.get("rule_id", ""),
            "category":  tc.get("category", ""),
            "query":     query,
            "reference": ref,
            "generated": generated,
            "failed":    generated == "",
        })

    # ── Step 2: BLEU & ROUGE per test case ────────────────────────────────────
    print("\n📊 Menghitung BLEU & ROUGE...")
    for i, res in enumerate(results):
        if res["failed"]:
            res.update({
                "bleu_1": 0, "bleu_2": 0, "bleu_3": 0, "bleu_4": 0,
                "rouge_1": 0, "rouge_2": 0, "rouge_l": 0,
            })
            continue

        bleu  = compute_bleu(res["generated"], res["reference"])
        rouge = compute_rouge(res["generated"], res["reference"])
        res.update(bleu)
        res.update(rouge)

    # ── Step 3: BERTScore (batch) ─────────────────────────────────────────────
    valid_idx  = [i for i, r in enumerate(results) if not r["failed"]]
    valid_hyps = [hypotheses[i] for i in valid_idx]
    valid_refs = [references[i] for i in valid_idx]

    if valid_hyps:
        bert_scores = compute_bertscore(valid_hyps, valid_refs)
        for i, bs in zip(valid_idx, bert_scores):
            results[i].update(bs)

    for res in results:
        if res["failed"]:
            res.update({
                "bertscore_precision": 0,
                "bertscore_recall":    0,
                "bertscore_f1":        0,
            })

    # ── Step 4: Tampilkan tabel hasil ────────────────────────────────────────
    print("\n" + "=" * 65)
    print(f"{'ID':<8} {'BLEU-1':>7} {'BLEU-4':>7} {'R-1':>7} {'R-L':>7} {'BERT-F1':>8}")
    print("-" * 65)
    for res in results:
        status = "❌" if res["failed"] else "✅"
        print(
            f"{status} {res['id']:<6} "
            f"{res.get('bleu_1', 0):>7.4f} "
            f"{res.get('bleu_4', 0):>7.4f} "
            f"{res.get('rouge_1', 0):>7.4f} "
            f"{res.get('rouge_l', 0):>7.4f} "
            f"{res.get('bertscore_f1', 0):>8.4f}"
        )
    print("=" * 65)

    # ── Step 5: Summary rata-rata ─────────────────────────────────────────────
    valid = [r for r in results if not r["failed"]]
    n     = len(valid) or 1

    summary = {
        "evaluated_at":        datetime.now().isoformat(),
        "total_test_cases":    len(test_cases),
        "successful":          len(valid),
        "failed":              len(failed_cases),
        "failed_ids":          failed_cases,
        "avg_bleu_1":          round(sum(r["bleu_1"]  for r in valid) / n, 4),
        "avg_bleu_2":          round(sum(r["bleu_2"]  for r in valid) / n, 4),
        "avg_bleu_3":          round(sum(r["bleu_3"]  for r in valid) / n, 4),
        "avg_bleu_4":          round(sum(r["bleu_4"]  for r in valid) / n, 4),
        "avg_rouge_1":         round(sum(r["rouge_1"] for r in valid) / n, 4),
        "avg_rouge_2":         round(sum(r["rouge_2"] for r in valid) / n, 4),
        "avg_rouge_l":         round(sum(r["rouge_l"] for r in valid) / n, 4),
        "avg_bertscore_p":     round(sum(r["bertscore_precision"] for r in valid) / n, 4),
        "avg_bertscore_r":     round(sum(r["bertscore_recall"]    for r in valid) / n, 4),
        "avg_bertscore_f1":    round(sum(r["bertscore_f1"]        for r in valid) / n, 4),
    }

    print(f"\n📈 Rata-rata ({len(valid)} test case berhasil):")
    print(f"   BLEU-1 : {summary['avg_bleu_1']:.4f}")
    print(f"   BLEU-4 : {summary['avg_bleu_4']:.4f}")
    print(f"   ROUGE-1: {summary['avg_rouge_1']:.4f}")
    print(f"   ROUGE-2: {summary['avg_rouge_2']:.4f}")
    print(f"   ROUGE-L: {summary['avg_rouge_l']:.4f}")
    print(f"   BERT-P : {summary['avg_bertscore_p']:.4f}")
    print(f"   BERT-R : {summary['avg_bertscore_r']:.4f}")
    print(f"   BERT-F1: {summary['avg_bertscore_f1']:.4f}")

    # ── Step 6: Simpan hasil ──────────────────────────────────────────────────
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    detail_path  = RESULTS_DIR / f"nlg_eval_detail_{ts}.json"
    summary_path = RESULTS_DIR / f"nlg_eval_summary_{ts}.json"
    latest_path  = RESULTS_DIR / "nlg_eval_latest.json"

    with open(detail_path,  "w", encoding="utf-8") as f:
        json.dump(results,  f, ensure_ascii=False, indent=2)
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary,  f, ensure_ascii=False, indent=2)
    with open(latest_path,  "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "details": results}, f, ensure_ascii=False, indent=2)

    print(f"\n💾 Hasil disimpan:")
    print(f"   Detail : {detail_path.name}")
    print(f"   Summary: {summary_path.name}")
    print(f"   Latest : {latest_path.name}")
    print()

    return summary, results


# ── Mock generator (untuk testing tanpa backend) ──────────────────────────────
def _mock_generate(tc: dict) -> str:
    """
    Simulasi output NLG sederhana berdasarkan query.
    Dipakai saat backend tidak aktif (use_mock=True).
    """
    templates = {
        "order_hsi":       "Data order HSI menunjukkan tren positif dengan pertumbuhan yang konsisten di beberapa periode terakhir.",
        "revenue_hsi":     "Revenue HSI mengalami peningkatan signifikan yang didorong oleh pertumbuhan jumlah pelanggan aktif.",
        "churn_hsi":       "Tingkat churn pelanggan HSI bervariasi antar wilayah dan memerlukan perhatian pada daerah dengan churn tinggi.",
        "realisasi_hsi":   "Realisasi target HSI menunjukkan pencapaian yang bervariasi, dengan beberapa regional melampaui target.",
        "fulfillment_hsi": "Tingkat fulfillment order HSI mencerminkan efisiensi operasional dalam penyelesaian permintaan pelanggan.",
        "install_time":    "Rata-rata waktu instalasi HSI menunjukkan durasi yang perlu dioptimalkan untuk meningkatkan kepuasan pelanggan.",
    }
    return templates.get(tc.get("category", ""), "Data menunjukkan hasil analisis yang informatif.")


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="BrightAI NLG Evaluator")
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Gunakan mock response tanpa memanggil backend (untuk testing cepat)",
    )
    args = parser.parse_args()

    run_evaluation(use_mock=args.mock)
