'use strict';

/**
 * intentClassifier.js
 * ───────────────────
 * Mengklasifikasi intent dan fokus dari pertanyaan pengguna.
 * Digunakan NLG untuk memilih template yang tepat agar respons
 * terasa personal dan sesuai dengan apa yang ditanyakan.
 *
 * Intent yang didukung:
 *   quantity   — berapa, jumlah, total
 *   trend      — tren, pertumbuhan, naik/turun, growth
 *   comparison — bandingkan, vs, antara, perbedaan
 *   location   — dimana, regional, witel, wilayah
 *   performance— performa, kinerja, target, pencapaian
 *   detail     — rincian, breakdown, distribusi, segmentasi
 *   reason     — kenapa, mengapa, faktor, penyebab
 *   general    — fallback
 */

const INTENT_PATTERNS = {
  quantity: {
    weight: 3,
    keywords: [
      'berapa', 'jumlah', 'total', 'banyak', 'volume',
      'angka', 'hitungan', 'berapa banyak', 'sebesar',
      'berapa order', 'berapa revenue', 'berapa pelanggan',
    ],
  },
  trend: {
    weight: 3,
    keywords: [
      'tren', 'trend', 'pertumbuhan', 'perkembangan',
      'naik', 'turun', 'meningkat', 'menurun', 'growth',
      'kenaikan', 'penurunan', 'mom', 'yoy',
      'bulanan', 'tahunan', 'berkembang', 'perubahan',
    ],
  },
  comparison: {
    weight: 3,
    keywords: [
      'bandingkan', 'banding', 'dibanding', 'vs',
      'versus', 'perbedaan', 'perbandingan', 'antara',
      'lebih tinggi', 'lebih rendah', 'mana yang lebih',
      'bisnis dan basic', 'basic dan bisnis',
    ],
  },
  location: {
    weight: 3,
    keywords: [
      'dimana', 'di mana', 'regional', 'witel',
      'wilayah', 'area', 'daerah', 'mana yang',
      'mana paling', 'per wilayah', 'per regional',
      'per witel', 'geografis', 'peta',
    ],
  },
  reason: {
    weight: 4,
    keywords: [
      'kenapa', 'mengapa', 'apa penyebab', 'faktor',
      'alasan', 'penyebab', 'akibat', 'dampak',
      'karena', 'disebabkan', 'apa yang menyebabkan',
    ],
  },
  performance: {
    weight: 3,
    keywords: [
      'performa', 'kinerja', 'pencapaian', 'target',
      'achievement', 'capai', 'realisasi', 'efektivitas',
      'efisiensi', 'sla', 'tingkat keberhasilan',
    ],
  },
  detail: {
    weight: 2,
    keywords: [
      'detail', 'rincian', 'breakdown', 'kategori',
      'segmentasi', 'distribusi', 'klasifikasi',
      'analisis', 'lengkap', 'secara detail',
    ],
  },
};

const FOCUS_PATTERNS = {
  order:       ['order', 'pesanan', 'pemesanan', 'transaksi', 'penjualan', 'hsi bisnis', 'hsi basic'],
  revenue:     ['revenue', 'pendapatan', 'pemasukan', 'income', 'omzet'],
  churn:       ['churn', 'ct0', 'cabut', 'nonaktif', 'berhenti', 'kehilangan pelanggan', 'dinolkan'],
  fulfillment: ['fulfillment', 'pemenuhan', 'penyelesaian', 'instalasi', 'install', 'sukses order'],
  subscriber:  ['subscriber', 'pelanggan', 'pengguna', 'customer', 'aktif'],
  bundling:    ['bundling', 'bundle', 'paket', 'kombinasi', 'ala carte', 'hard bundling'],
  digital:     ['digital', 'pijar', 'netmonk', 'oca', 'sekolah', 'interaction', 'blast'],
  target:      ['target', 'realisasi', 'pencapaian', 'kpi', 'achievement'],
};

/**
 * Menghitung skor intent berdasarkan kecocokan kata kunci.
 */
function scoreIntent(input, keywords, weight) {
  const lower = input.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score += weight;
  }
  return score;
}

/**
 * Mengklasifikasi intent dan fokus dari teks pertanyaan.
 *
 * @param {string} userInput
 * @returns {{ intent: string, focus: string, confidence: number }}
 */
function classify(userInput) {
  if (!userInput || typeof userInput !== 'string') {
    return { intent: 'general', focus: 'order', confidence: 0 };
  }

  // Skor setiap intent
  const scores = {};
  for (const [intent, cfg] of Object.entries(INTENT_PATTERNS)) {
    scores[intent] = scoreIntent(userInput, cfg.keywords, cfg.weight);
  }

  // Pilih intent dengan skor tertinggi
  const topIntent = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0];

  const intent     = topIntent[1] > 0 ? topIntent[0] : 'general';
  const confidence = Math.min(100, topIntent[1] * 10);

  // Skor fokus
  const focusScores = {};
  for (const [focus, kws] of Object.entries(FOCUS_PATTERNS)) {
    focusScores[focus] = scoreIntent(userInput, kws, 1);
  }
  const topFocus = Object.entries(focusScores).sort((a, b) => b[1] - a[1])[0];
  const focus    = topFocus[1] > 0 ? topFocus[0] : 'order';

  return { intent, focus, confidence };
}

module.exports = { classify };
