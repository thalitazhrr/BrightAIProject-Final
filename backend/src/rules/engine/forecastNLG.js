'use strict';

/**
 * forecastNLG.js
 * ──────────────
 * Menghasilkan narasi paragraf Bahasa Indonesia baku (KBBI) dari hasil prediksi ML.
 * Mendukung ≥ 3 variasi template per metrik, dipilih berdasarkan pertanyaan pengguna
 * agar output terasa personal dan tidak repetitif.
 */

// ── Konteks per metrik ─────────────────────────────────────────────────────────

const METRIC_CONFIG = {
  order_hsi: {
    label: 'Order HSI',
    subjek: 'jumlah order High Speed Internet (HSI)',
    naik: 'Peningkatan volume order perlu diantisipasi dengan kesiapan tim instalasi serta kapasitas infrastruktur jaringan yang memadai guna menjaga tingkat layanan (SLA) tetap terpenuhi.',
    turun: 'Penurunan volume order perlu dikaji lebih lanjut, baik dari sisi faktor musiman, pergeseran kompetitor, maupun perubahan pola permintaan secara struktural.',
    tip: 'Pantau kesiapan kapasitas STO dan ketersediaan sumber daya manusia instalasi di setiap witel untuk mengantisipasi perubahan volume.',
  },
  churn_hsi: {
    label: 'Churn HSI',
    subjek: 'jumlah penonaktifan layanan (churn) HSI',
    naik: 'Peningkatan churn memerlukan respons segera. Evaluasi efektivitas program retensi dan identifikasi segmen pelanggan yang paling rentan terhadap penonaktifan layanan.',
    turun: 'Penurunan churn mengindikasikan efektivitas program retensi yang sedang berjalan. Pertahankan dan perkuat inisiatif yang telah memberikan dampak positif ini.',
    tip: 'Analisis churn berdasarkan kategori bandwidth dan masa berlangganan dapat membantu mengidentifikasi pola serta mencegah gelombang churn berikutnya.',
    invertTrend: true,
  },
  realisasi_hsi: {
    label: 'Realisasi HSI',
    subjek: 'realisasi pemasangan layanan HSI (SSL)',
    naik: 'Peningkatan realisasi mengindikasikan perbaikan pencapaian terhadap target. Pertahankan kinerja operasional yang mendukung tren positif ini.',
    turun: 'Penurunan realisasi berisiko memperlebar kesenjangan terhadap target yang ditetapkan. Evaluasi kapasitas jalur instalasi dan pipeline order yang ada.',
    tip: 'Bandingkan proyeksi ini dengan target bulanan untuk menghitung estimasi pencapaian kumulatif hingga akhir tahun.',
  },
  subscriber_hsi: {
    label: 'Subscriber HSI',
    subjek: 'jumlah pelanggan aktif layanan HSI',
    naik: 'Pertumbuhan pelanggan aktif menunjukkan ekspansi bisnis yang sehat. Pastikan kualitas layanan tetap terjaga seiring dengan bertambahnya volume pelanggan.',
    turun: 'Penurunan pelanggan aktif mengindikasikan bahwa tingkat churn melampaui akuisisi pelanggan baru. Diperlukan strategi retensi dan akuisisi yang lebih agresif.',
    tip: 'Pertumbuhan bersih pelanggan merupakan selisih antara order baru yang terfulfill dan jumlah churn. Pantau kedua sisi secara bersamaan untuk gambaran yang utuh.',
  },
  avg_install_days: {
    label: 'Rata-rata Hari Instalasi HSI',
    subjek: 'rata-rata durasi instalasi layanan HSI',
    naik: 'Perpanjangan waktu instalasi berdampak langsung pada kepuasan pelanggan dan pemenuhan SLA. Identifikasi bottleneck pada tahap pra-instalasi untuk mempercepat proses.',
    turun: 'Penurunan rata-rata waktu instalasi menunjukkan peningkatan efisiensi operasional yang signifikan dan berdampak positif pada pengalaman pelanggan.',
    tip: 'Target SLA instalasi umumnya berkisar antara 3 hingga 7 hari kerja. Tinjau distribusi durasi per witel untuk menemukan titik lemah yang perlu diperbaiki.',
    invertTrend: true,
  },
};

const MODEL_LABEL = {
  gru:  'GRU (Gated Recurrent Unit)',
  lstm: 'LSTM (Long Short-Term Memory)',
  tft:  'TFT (Temporal Fusion Transformer)',
};

// ── Pembantu format ────────────────────────────────────────────────────────────

function fmt(v, unit) {
  if (v === null || v === undefined) return '-';
  const rounded = Math.round(Number(v));
  if (unit === 'Rp') return `Rp\u00A0${rounded.toLocaleString('id-ID')}`;
  if (unit === '%')  return `${rounded}%`;
  return `${rounded.toLocaleString('id-ID')}\u00A0${unit}`;
}

function fmtPct(pct) {
  const abs  = Math.abs(pct);
  const sign = pct >= 0 ? '+' : '-';
  return `${sign}${abs.toFixed(1)}%`;
}

function bulanIndonesia(periodeStr) {
  if (!periodeStr) return periodeStr;
  const BULAN = ['Januari','Februari','Maret','April','Mei','Juni',
                 'Juli','Agustus','September','Oktober','November','Desember'];
  const [tahun, bulan] = periodeStr.split('-');
  if (!tahun || !bulan) return periodeStr;
  return `${BULAN[parseInt(bulan, 10) - 1]} ${tahun}`;
}

function magnitudeProse(pct) {
  const abs  = Math.abs(pct);
  const arah = pct >= 0 ? 'meningkat' : 'menurun';
  if (abs < 2)  return `relatif stabil dengan perubahan sebesar ${fmtPct(pct)}`;
  if (abs < 10) return `${arah} secara moderat sebesar ${fmtPct(pct)}`;
  if (abs < 25) return `${arah} cukup signifikan sebesar ${fmtPct(pct)}`;
  return `${arah} sangat signifikan sebesar ${fmtPct(pct)}`;
}

// Hash sederhana untuk pemilihan varian deterministik
function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Template varian ────────────────────────────────────────────────────────────

/**
 * Mengembalikan array template (function) untuk masing-masing gaya narasi.
 * Setiap template menerima objek `p` (parameter) dan mengembalikan string paragraf.
 */
function buildVariants(cfg, p) {
  const { model, scope, periodeAktual, periodePrediksi, pct, isUp, subjek } = p;
  const arahKonteks = isUp ? cfg.naik : cfg.turun;

  return [
    // ── Varian 0: Gaya laporan analis — temuan → rentang → rekomendasi ─────────
    () => {
      const parts = [];
      parts.push(
        `Berdasarkan hasil analisis model **${model}** yang dilatih menggunakan data historis ` +
        `hingga **${periodeAktual}**, ${subjek} untuk **${scope}** pada bulan **${periodePrediksi}** ` +
        `diprediksi akan **${magnitudeProse(pct)}**, yakni dari ${fmt(p.lastActual, p.unit)} ` +
        `menjadi **${fmt(p.prediction, p.unit)}**.`
      );
      if (p.ciLevel && p.ciLower != null && p.ciUpper != null) {
        parts.push(
          `Dengan tingkat kepercayaan **${p.ciLevel}**, nilai aktual diperkirakan berada ` +
          `dalam rentang **${fmt(p.ciLower, p.unit)}** hingga **${fmt(p.ciUpper, p.unit)}**. ` +
          `Rentang ini mencerminkan ketidakpastian bawaan dari model deret waktu pada horizon satu bulan ke depan ` +
          `dan sebaiknya dijadikan acuan batas bawah serta batas atas dalam perencanaan operasional.`
        );
      }
      if (arahKonteks) {
        parts.push(arahKonteks + (cfg.tip ? ` ${cfg.tip}` : ''));
      }
      return parts.join('\n\n');
    },

    // ── Varian 1: Gaya ringkas — langsung ke angka, lalu konteks ──────────────
    () => {
      const parts = [];
      const arahSingkat = pct >= 0 ? 'naik' : 'turun';
      parts.push(
        `Model **${model}** memproyeksikan ${subjek} di **${scope}** pada **${periodePrediksi}** ` +
        `sebesar **${fmt(p.prediction, p.unit)}** — ${arahSingkat} **${fmtPct(pct)}** ` +
        `dibandingkan realisasi **${periodeAktual}** yang tercatat **${fmt(p.lastActual, p.unit)}**.`
      );
      if (arahKonteks) {
        parts.push(arahKonteks);
      }
      if (cfg.tip) {
        parts.push(`**Catatan operasional:** ${cfg.tip}`);
      }
      if (p.ciLevel && p.ciLower != null && p.ciUpper != null) {
        parts.push(
          `Rentang kepercayaan **${p.ciLevel}**: antara **${fmt(p.ciLower, p.unit)}** ` +
          `dan **${fmt(p.ciUpper, p.unit)}**.`
        );
      }
      return parts.join('\n\n');
    },

    // ── Varian 2: Gaya naratif kontekstual — tren dulu, baru angka ─────────────
    () => {
      const parts = [];
      const besarPerubahan = magnitudeProse(pct);
      parts.push(
        `Memasuki **${periodePrediksi}**, ${subjek} untuk wilayah **${scope}** diproyeksikan ` +
        `akan **${besarPerubahan}**. Model **${model}** — yang menggunakan data historis ` +
        `sampai dengan **${periodeAktual}** sebagai basis pelatihan — menghasilkan estimasi ` +
        `sebesar **${fmt(p.prediction, p.unit)}** dari posisi sebelumnya di angka ` +
        `**${fmt(p.lastActual, p.unit)}**.`
      );
      if (p.ciLevel && p.ciLower != null && p.ciUpper != null) {
        parts.push(
          `Proyeksi ini disertai interval kepercayaan **${p.ciLevel}** pada kisaran ` +
          `**${fmt(p.ciLower, p.unit)}** — **${fmt(p.ciUpper, p.unit)}**, ` +
          `yang mencerminkan batas variabilitas wajar untuk horizon prediksi satu bulan.`
        );
      }
      if (arahKonteks) {
        parts.push(arahKonteks + (cfg.tip ? ` ${cfg.tip}` : ''));
      }
      return parts.join('\n\n');
    },

    // ── Varian 3: Gaya pertanyaan-jawaban — menjawab "berapa prediksi..." ───────
    () => {
      const parts = [];
      parts.push(
        `Prediksi ${subjek} untuk **${scope}** pada **${periodePrediksi}** ` +
        `adalah **${fmt(p.prediction, p.unit)}**. ` +
        `Nilai ini dihitung oleh model **${model}** berdasarkan pola historis ` +
        `hingga **${periodeAktual}**, yang menunjukkan perubahan sebesar **${fmtPct(pct)}** ` +
        `dari angka aktual sebelumnya (**${fmt(p.lastActual, p.unit)}**).`
      );
      if (p.ciLevel && p.ciLower != null && p.ciUpper != null) {
        parts.push(
          `Dengan kepercayaan **${p.ciLevel}**, nilai sebenarnya pada bulan tersebut ` +
          `diprediksi berada di antara **${fmt(p.ciLower, p.unit)}** ` +
          `dan **${fmt(p.ciUpper, p.unit)}**.`
        );
      }
      if (arahKonteks) parts.push(arahKonteks);
      if (cfg.tip)     parts.push(`**Tips analisis:** ${cfg.tip}`);
      return parts.join('\n\n');
    },
  ];
}

// ── Tabel ringkasan kecil ──────────────────────────────────────────────────────

function buildTable(p, periodeAktual, periodePrediksi) {
  const rows = [
    `| Aktual ${periodeAktual} | ${fmt(p.lastActual, p.unit)} |`,
    `| Prediksi ${periodePrediksi} | **${fmt(p.prediction, p.unit)}** |`,
    `| Perubahan | **${fmtPct(p.changePct ?? 0)}** |`,
  ];
  if (p.ciLevel && p.ciLower != null) {
    rows.push(
      `| Interval Kepercayaan (${p.ciLevel}) | ${fmt(p.ciLower, p.unit)} — ${fmt(p.ciUpper, p.unit)} |`
    );
  }
  return `| Keterangan | Nilai |\n|---|---|\n${rows.join('\n')}`;
}

// ── Generator utama ────────────────────────────────────────────────────────────

/**
 * Menghasilkan narasi paragraf Bahasa Indonesia dari data prediksi.
 * @param {Object} data      - payload dari ForecastPanel
 * @param {string} userInput - pertanyaan pengguna (opsional, untuk pemilihan varian)
 * @returns {string}         - teks Markdown berupa paragraf narasi
 */
function generate(data, userInput = '') {
  const cfg     = METRIC_CONFIG[data.metric] || {};
  const scope   = data.witel
    ? `${data.regional} / ${data.witel}`
    : data.regional === 'NASIONAL' ? 'tingkat nasional' : data.regional;
  const model          = MODEL_LABEL[data.model] || data.model;
  const pct            = data.changePct ?? 0;
  const isUp           = pct >= 0;
  const subjek         = cfg.subjek || `nilai ${data.metricLabel}`;
  const periodeAktual  = bulanIndonesia(data.lastPeriod);
  const periodePrediksi = bulanIndonesia(data.forecastPeriod);

  const p = {
    ...data, model, scope, periodeAktual, periodePrediksi,
    pct, isUp, subjek,
  };

  // Pilih varian secara deterministik dari pertanyaan pengguna
  const variants = buildVariants(cfg, p);
  const idx      = simpleHash(userInput || data.metric) % variants.length;
  const prose    = variants[idx]();

  const tabel = buildTable(p, periodeAktual, periodePrediksi);

  const parts = [
    `## Prediksi ${cfg.label || data.metricLabel} — ${scope}`,
    '',
    prose,
    '',
    tabel,
  ];

  if (data.inferenceMs != null) {
    parts.push('', `---`, `_Model: ${model} · Inferensi: ${data.inferenceMs}\u00A0ms_`);
  }

  return parts.join('\n');
}

module.exports = { generate };
