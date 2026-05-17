# NLG Evaluation — BrightAI

Evaluasi kualitas output Natural Language Generation (NLG) menggunakan tiga metrik standar NLP.

## Metrik yang Digunakan

| Metrik | Fungsi | Range |
|--------|--------|-------|
| **BLEU-1 s/d BLEU-4** | Mengukur n-gram precision antara teks generated dan reference | 0–1 (makin tinggi makin baik) |
| **ROUGE-1, ROUGE-2, ROUGE-L** | Mengukur recall n-gram dan longest common subsequence | 0–1 (makin tinggi makin baik) |
| **BERTScore (P, R, F1)** | Mengukur kemiripan semantik menggunakan BERT multilingual | 0–1 (makin tinggi makin baik) |

## Struktur File

```
evaluation/
├── nlg_eval.py          ← Script evaluasi utama
├── test_cases.json      ← 12 pasang query + reference response
├── README.md            ← Dokumentasi ini
└── results/
    ├── nlg_eval_latest.json          ← Hasil evaluasi terbaru
    ├── nlg_eval_detail_<ts>.json     ← Detail per test case
    └── nlg_eval_summary_<ts>.json    ← Ringkasan rata-rata skor
```

## Cara Menjalankan

### 1. Install dependencies
```bash
pip install nltk rouge-score bert-score torch transformers
```

### 2. Pastikan backend BrightAI aktif
```bash
# Di direktori backend
npm start
# Backend harus berjalan di http://localhost:3001
```

### 3. Jalankan evaluasi
```bash
cd backend/evaluation

# Evaluasi penuh (memanggil backend)
python nlg_eval.py

# Testing cepat tanpa backend (mock response)
python nlg_eval.py --mock
```

## Test Cases

12 test case mencakup 6 kategori:

| Kategori | Rule | Jumlah TC |
|----------|------|-----------|
| Order HSI (nasional, regional, bandwidth) | ps_001, ps_002, ps_003 | 4 |
| Coverage STO | ps_004 | 1 |
| Revenue HSI | mart_001, mart_003 | 2 |
| Churn HSI | ct0_001, ct0_002 | 2 |
| Realisasi Target | target_001 | 1 |
| Fulfillment & Install Time | ps_006, ps_007 | 2 |

## Interpretasi Skor

### BLEU
- Template-based NLG cenderung menghasilkan BLEU yang stabil namun tidak terlalu tinggi karena variasi kalimat
- BLEU-1 > 0.3 : cukup baik untuk domain spesifik
- BLEU-4 > 0.1 : wajar untuk teks paragraf (bukan terjemahan)

### ROUGE
- ROUGE-1 > 0.4 : overlap unigram yang baik
- ROUGE-L > 0.3 : struktur kalimat cukup mirip reference

### BERTScore
- Paling relevan untuk teks Indonesia karena mengukur makna, bukan hanya kata
- BERTScore F1 > 0.75 : kemiripan semantik yang baik
- BERTScore F1 > 0.85 : sangat baik

## Catatan Metodologi

Evaluasi ini menggunakan **reference texts yang ditulis manual** sebagai ground truth. Reference mencerminkan karakteristik output NLG yang ideal:
- Informatif dan berbasis data
- Menggunakan Bahasa Indonesia formal
- Mencakup insight bisnis yang relevan
- Memberikan rekomendasi actionable

Karena NLG BrightAI bersifat **rule-based/template**, skor BLEU/ROUGE yang moderat adalah hal yang wajar — yang terpenting adalah BERTScore yang mengukur kualitas semantik.
