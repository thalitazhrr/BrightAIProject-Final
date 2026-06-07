// src/rules/templates/welcomeTemplates.js

// ── Katalog topik lengkap ──────────────────────────────────────────────────────
const TOPIC_CATALOG = [
  {
    label: '[1] Order & Sales HSI',
    keywords: ['order', 'total order', 'order HSI', 'bisnis', 'basic', 'fulfillment',
               'channel', 'channel performance', 'instalasi', 'install', 'penetrasi',
               'bandwidth', 'tren order', 'growth', 'seasonal', 'pertumbuhan order'],
    examples: [
      'Berapa total order HSI bisnis dan basic bulan ini?',
      'Bagaimana tren order HSI per bandwidth dalam 6 bulan terakhir?',
      'Analisis channel performance untuk HSI',
      'Berapa rata-rata waktu instalasi HSI per regional?',
      'Penetrasi HSI per wilayah bulan ini',
    ]
  },
  {
    label: '[2] Revenue HSI',
    keywords: ['revenue', 'pendapatan', 'billing', 'recurring', 'gl account',
               'one-time', 'tren revenue', 'revenue per regional', 'revenue lifecycle',
               'cross regional revenue'],
    examples: [
      'Tren revenue HSI bulanan dan pertumbuhannya',
      'Breakdown revenue berdasarkan GL account HSI',
      'Perbandingan recurring vs one-time revenue HSI',
      'Revenue HSI per regional bulan ini',
    ]
  },
  {
    label: '[3] Profil & Segmentasi Pelanggan',
    keywords: ['pelanggan', 'customer', 'segmentasi', 'segmen', 'profil pelanggan',
               'loyalitas', 'loyalty', 'distribusi bandwidth', 'klaster', 'cluster',
               'retensi', 'retention', 'nilai pelanggan', 'distribusi geografis',
               'sebaran pelanggan', 'profil wilayah'],
    examples: [
      'Segmentasi pelanggan HSI berdasarkan speed dan revenue',
      'Profil customer HSI per wilayah',
      'Distribusi bandwidth pelanggan HSI aktif',
      'Analisis loyalitas pelanggan HSI',
      'Distribusi geografis pelanggan HSI per wilayah',
    ]
  },
  {
    label: '[4] Target & Realisasi HSI',
    keywords: ['target', 'realisasi', 'achievement', 'pencapaian', 'KPI',
               'target vs actual', 'gap target', 'achievement rate'],
    examples: [
      'Achievement rate target realisasi HSI per regional?',
      'Perbandingan target vs realisasi HSI bulan ini',
      'Gap antara target dan realisasi HSI per witel',
    ]
  },
  {
    label: '[5] Analisis Churn',
    keywords: ['churn', 'cabut', 'berhenti berlangganan', 'kehilangan pelanggan',
               'CT0', 'churn rate', 'churn regional', 'tren churn', 'risiko churn'],
    examples: [
      'Analisis tingkat churn pelanggan internet per regional',
      'Tren churn HSI 6 bulan terakhir',
      'Wilayah mana yang memiliki churn rate tertinggi?',
    ]
  }
];

// ── Fungsi helper ──────────────────────────────────────────────────────────────

function _formatTopicCatalog() {
  return TOPIC_CATALOG.map(topic => {
    const keywordStr = topic.keywords.slice(0, 6).map(k => `\`${k}\``).join(', ');
    const exampleStr = topic.examples.map(e => `  - ${e}`).join('\n');
    return `**${topic.label}**\nKata kunci: ${keywordStr}\nContoh pertanyaan:\n${exampleStr}`;
  }).join('\n\n');
}

function _formatPartialSuggestions(partialMatches) {
  if (!partialMatches || partialMatches.length === 0) return null;
  const lines = partialMatches.map(m => `  - ${m.description}`);
  return `Mungkin kamu bermaksud menanyakan:\n${lines.join('\n')}`;
}

// ── Public functions ───────────────────────────────────────────────────────────

function generateWelcomeMessage() {
  const topicList = TOPIC_CATALOG.map(t => `- **${t.label}**`).join('\n');
  const exampleList = TOPIC_CATALOG.flatMap(t => t.examples.slice(0, 1))
    .map(e => `- ${e}`).join('\n');

  return `**Selamat datang di BrightAI!** Saya adalah asisten analisis data Telkom yang siap membantu menganalisis performa HSI dari berbagai dimensi.

**Topik yang bisa saya bantu:**

${topicList}

**Contoh pertanyaan:**
${exampleList}

Silakan ajukan pertanyaan, atau gunakan **Guided Flow** untuk memilih topik dan wilayah secara langsung.`;
}

function generateFallbackResponse(reason = 'no_matching_rule', partialMatches = []) {
  if (reason === 'processing_error') {
    return generateErrorResponse('processing_error');
  }

  const suggestionBlock = _formatPartialSuggestions(partialMatches);
  const catalogBlock    = _formatTopicCatalog();

  let opening;
  if (suggestionBlock) {
    opening = `Pertanyaan kamu belum cukup spesifik untuk diproses. ${suggestionBlock}

Jika itu bukan yang kamu maksud, berikut panduan lengkap topik yang tersedia:`;
  } else {
    opening = `Maaf, pertanyaan kamu belum cocok dengan topik yang tersedia di BrightAI. Pastikan menggunakan kata kunci yang sesuai.\n\nBerikut panduan lengkap topik yang bisa ditanyakan:`;
  }

  return `${opening}

---

${catalogBlock}

---

**Tips:** Gunakan **Guided Flow** (tombol di kiri) untuk memilih topik, pertanyaan, dan wilayah secara langsung tanpa perlu mengetik manual.`;
}

function generateErrorResponse(errorType = 'processing_error') {
  const errors = {
    database_error:    'Terjadi kesalahan saat mengakses database. Silakan coba lagi dalam beberapa saat.',
    processing_error:  'Terjadi kesalahan dalam memproses permintaan. Silakan coba lagi atau sederhanakan pertanyaan kamu.',
    timeout_error:     'Permintaan memakan waktu terlalu lama. Coba lagi atau gunakan filter yang lebih spesifik.'
  };
  return errors[errorType] || errors.processing_error;
}

module.exports = {
  generateWelcomeMessage,
  generateFallbackResponse,
  generateErrorResponse
};
