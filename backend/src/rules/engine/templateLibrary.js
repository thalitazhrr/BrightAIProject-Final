'use strict';

/**
 * templateLibrary.js
 * ──────────────────
 * Kumpulan template narasi Bahasa Indonesia baku per intent.
 * Setiap intent memiliki minimal 3 varian agar respons tidak monoton.
 * Varian dipilih secara deterministik berdasarkan hash pertanyaan.
 *
 * Setiap template menerima `ctx` (context object) dan mengembalikan
 * string paragraf Markdown siap tampil.
 *
 * Struktur ctx:
 * {
 *   periode, mainValue, mainUnit, mainLabel, subjek, kategori,
 *   momValue, momKategori, momSelisih, yoyValue,
 *   breakdownProse, breakdownTable, hasBreakdown,
 *   bundlingProse, hasBundling,
 *   pelangganUnik, rataRataOrder, hasPelanggan,
 *   insightsBullets, hasInsights,
 *   trendProse, hasTrend,
 *   database, recordCount, execTime,
 * }
 */

// ── Pembantu ───────────────────────────────────────────────────────────────────

/**
 * Format nilai utama: bold hanya jika nilainya bukan placeholder '-'.
 * Menghindari output seperti "**- **" ketika data tidak tersedia.
 */
function fv(ctx) {
  if (!ctx.mainValue || ctx.mainValue === '-') return ctx.mainValue || '-';
  const u = ctx.mainUnit ? `\u00A0${ctx.mainUnit}` : '';
  return `**${ctx.mainValue}${u}**`;
}

function pilihVarian(variants, userInput) {
  const hash = (userInput || '').split('').reduce((s, c) => s + c.charCodeAt(0), 0);
  return variants[hash % variants.length];
}

function kat(ctx) {
  return ctx.kategori ? ` Kondisi ini dikategorikan sebagai **${ctx.kategori}**.` : '';
}

function growthParagraf(ctx) {
  const parts = [];
  if (ctx.momValue && ctx.momValue !== 'N/A' && ctx.momValue !== 'Belum tersedia') {
    let kalimat = `Dari sisi pertumbuhan bulan ke bulan (MoM), ${ctx.subjek} mencatat perubahan sebesar **${ctx.momValue}**`;
    if (ctx.momKategori) kalimat += `, yang dikategorikan sebagai *${ctx.momKategori}*`;
    if (ctx.momSelisih && ctx.momSelisih !== 'N/A') kalimat += `, setara dengan selisih ${ctx.momSelisih} unit dibandingkan bulan sebelumnya`;
    parts.push(kalimat + '.');
  }
  if (ctx.yoyValue && ctx.yoyValue !== 'Belum tersedia' && ctx.yoyValue !== 'N/A') {
    parts.push(`Secara tahunan (YoY), pertumbuhan tercatat sebesar **${ctx.yoyValue}**.`);
  } else if (ctx.momValue) {
    parts.push('Data pertumbuhan tahunan (YoY) belum tersedia karena cakupan data historis belum mencapai satu tahun penuh.');
  }
  return parts.join(' ');
}

function breakdownParagraf(ctx) {
  if (!ctx.hasBreakdown) return '';
  return `Adapun distribusi layanan pada periode tersebut terdiri atas ${ctx.breakdownProse}.`;
}

function bundlingParagraf(ctx) {
  if (!ctx.hasBundling) return '';
  return `Dari sisi strategi bundling, tercatat ${ctx.bundlingProse}.`;
}

function pelangganParagraf(ctx) {
  if (!ctx.hasPelanggan) return '';
  let kal = `Secara keseluruhan, terdapat **${ctx.pelangganUnik}** pelanggan unik yang aktif pada periode ini`;
  if (ctx.rataRataOrder) kal += `, dengan rata-rata **${ctx.rataRataOrder}** order per pelanggan`;
  return kal + '.';
}

function insightsParagraf(ctx) {
  if (!ctx.hasInsights) return '';
  return `Berdasarkan analisis mendalam terhadap data tersebut, diperoleh sejumlah wawasan bisnis yang perlu mendapat perhatian:\n\n${ctx.insightsBullets}`;
}

function trendParagraf(ctx) {
  if (!ctx.hasTrend) return '';
  return `Berdasarkan rekam jejak tiga bulan terakhir, ${ctx.subjek} memperlihatkan **${ctx.trendProse}**.`;
}

function footer(ctx) {
  return `\n---\n_Sumber: ${ctx.database} · ${(ctx.recordCount || 0).toLocaleString('id-ID')} rekaman · ${ctx.execTime || 0}\u00A0ms_`;
}

// ── TEMPLATES ─────────────────────────────────────────────────────────────────
//
// Struktur: TEMPLATES[intent] = [ fn_varian_1, fn_varian_2, fn_varian_3, ... ]
// Setiap fn menerima ctx dan mengembalikan string Markdown.

const TEMPLATES = {

  // ── QUANTITY: berapa / jumlah / total ───────────────────────────────────────
  quantity: [

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Pada **${ctx.periode}**, ${ctx.subjek} yang berhasil tercatat mencapai ${fv(ctx)}.` +
        kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const pel = pelangganParagraf(ctx);
      if (pel) paragraf.push(pel);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Data **${ctx.database}** mencatat sebanyak ${fv(ctx)} untuk ${ctx.subjek} ` +
        `pada periode **${ctx.periode}**.` + kat(ctx)
      );
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const pel = pelangganParagraf(ctx);
      if (pel) paragraf.push(pel);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Sebagai gambaran kinerja **${ctx.periode}**, sebanyak ${fv(ctx)} ` +
        `${ctx.subjek} berhasil terealisasi.` + kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const pel = pelangganParagraf(ctx);
      if (pel) paragraf.push(pel);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

  ],

  // ── TREND: tren / pertumbuhan / perkembangan ─────────────────────────────────
  trend: [

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Tren ${ctx.subjek} pada **${ctx.periode}** menunjukkan nilai sebesar ${fv(ctx)}.` +
        kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Perkembangan ${ctx.subjek} selama periode pengamatan menempatkan angka pada ${fv(ctx)} ` +
        `di **${ctx.periode}**.` + kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      const gp = growthParagraf(ctx);
      paragraf.push(
        `Analisis pertumbuhan ${ctx.subjek} pada **${ctx.periode}** — yang mencapai ${fv(ctx)} — ` +
        `memberikan gambaran dinamika berikut ini.` + kat(ctx)
      );
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

  ],

  // ── COMPARISON: bandingkan / vs / antara ─────────────────────────────────────
  comparison: [

    (ctx) => {
      const paragraf = [];
      if (ctx.hasBreakdown) {
        paragraf.push(
          `Perbandingan segmen layanan HSI pada **${ctx.periode}** menghasilkan total ${fv(ctx)}` +
          ` dengan distribusi sebagai berikut: ${ctx.breakdownProse}.`
        );
      } else {
        paragraf.push(
          `Perbandingan ${ctx.subjek} pada **${ctx.periode}** menunjukkan angka agregat sebesar ${fv(ctx)}.` +
          kat(ctx)
        );
      }
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Dari total ${fv(ctx)} ${ctx.subjek} yang tercatat pada **${ctx.periode}**, ` +
        (ctx.hasBreakdown
          ? `distribusinya terbagi menjadi: ${ctx.breakdownProse}.`
          : `data menggambarkan komposisi layanan secara keseluruhan.` + kat(ctx))
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      if (ctx.hasBreakdown) {
        paragraf.push(
          `Membandingkan segmen-segmen ${ctx.subjek} pada **${ctx.periode}** mengungkap bahwa ${ctx.breakdownProse}, ` +
          `dari total keseluruhan sebesar ${fv(ctx)}.`
        );
      } else {
        paragraf.push(
          `${ctx.mainLabel} pada **${ctx.periode}** mencapai ${fv(ctx)}.` + kat(ctx)
        );
      }
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const pel = pelangganParagraf(ctx);
      if (pel) paragraf.push(pel);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

  ],

  // ── LOCATION: dimana / regional / witel / wilayah ───────────────────────────
  location: [

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Analisis distribusi wilayah ${ctx.subjek} pada **${ctx.periode}** menunjukkan angka agregat ` +
        `sebesar ${fv(ctx)}.` + kat(ctx)
      );
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Pemetaan ${ctx.subjek} secara geografis pada **${ctx.periode}** menampilkan total ` +
        `${fv(ctx)} di seluruh wilayah.` + kat(ctx)
      );
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Data sebaran wilayah untuk ${ctx.subjek} pada **${ctx.periode}** mencatatkan total ` +
        `${fv(ctx)} secara nasional.` + kat(ctx)
      );
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

  ],

  // ── PERFORMANCE: performa / kinerja / target / pencapaian ───────────────────
  performance: [

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Evaluasi kinerja ${ctx.subjek} pada **${ctx.periode}** menunjukkan capaian sebesar ` +
        `${fv(ctx)}.` + kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Performa ${ctx.subjek} pada **${ctx.periode}** berada pada level ${fv(ctx)}.` +
        kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Dari perspektif kinerja operasional, ${ctx.subjek} pada **${ctx.periode}** ` +
        `mencatatkan angka ${fv(ctx)}.` + kat(ctx)
      );
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const pel = pelangganParagraf(ctx);
      if (pel) paragraf.push(pel);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

  ],

  // ── DETAIL: rincian / breakdown / distribusi / segmentasi ───────────────────
  detail: [

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Berikut adalah rincian lengkap ${ctx.subjek} pada **${ctx.periode}** ` +
        `dengan total sebesar ${fv(ctx)}.` + kat(ctx)
      );
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const pel = pelangganParagraf(ctx);
      if (pel) paragraf.push(pel);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Analisis mendalam ${ctx.subjek} pada **${ctx.periode}** mengungkap komposisi berikut, ` +
        `dengan total agregat mencapai ${fv(ctx)}.` + kat(ctx)
      );
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Distribusi ${ctx.subjek} secara terperinci pada **${ctx.periode}** ` +
        `memperlihatkan total ${fv(ctx)}.` + kat(ctx)
      );
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const pel = pelangganParagraf(ctx);
      if (pel) paragraf.push(pel);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

  ],

  // ── REASON: kenapa / mengapa / faktor / penyebab ────────────────────────────
  reason: [

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Berdasarkan data yang tersedia, kondisi ${ctx.subjek} pada **${ctx.periode}** ` +
        `— yang mencapai ${fv(ctx)} — dipengaruhi oleh sejumlah faktor berikut.` +
        kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Untuk memahami dinamika ${ctx.subjek} yang berada pada ${fv(ctx)} ` +
        `di **${ctx.periode}**, perlu ditelaah sejumlah indikator kunci berikut ini.` + kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Data **${ctx.database}** memberikan beberapa petunjuk mengenai faktor-faktor yang memengaruhi ` +
        `${ctx.subjek} pada **${ctx.periode}**, yang tercatat sebesar ${fv(ctx)}.`
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

  ],

  // ── GENERAL: fallback ────────────────────────────────────────────────────────
  general: [

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Hasil analisis ${ctx.subjek} pada **${ctx.periode}** menunjukkan angka sebesar ` +
        `${fv(ctx)}.` + kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const bun = bundlingParagraf(ctx);
      if (bun) paragraf.push(bun);
      const pel = pelangganParagraf(ctx);
      if (pel) paragraf.push(pel);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `${ctx.mainLabel} pada **${ctx.periode}** mencapai ${fv(ctx)}.` +
        kat(ctx)
      );
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      const tr = trendParagraf(ctx);
      if (tr) paragraf.push(tr);
      return paragraf.join('\n\n') + footer(ctx);
    },

    (ctx) => {
      const paragraf = [];
      paragraf.push(
        `Berdasarkan data **${ctx.database}**, ${ctx.subjek} pada **${ctx.periode}** ` +
        `tercatat sebesar ${fv(ctx)}.` + kat(ctx)
      );
      const gp = growthParagraf(ctx);
      if (gp) paragraf.push(gp);
      const bp = breakdownParagraf(ctx);
      if (bp) paragraf.push(bp);
      const ins = insightsParagraf(ctx);
      if (ins) paragraf.push(ins);
      return paragraf.join('\n\n') + footer(ctx);
    },

  ],
};

/**
 * Ambil template yang sesuai berdasarkan intent dan userInput.
 * Varian dipilih deterministik agar BLEU bisa dihitung terhadap referensi.
 */
function getTemplate(intent, userInput) {
  const variants = TEMPLATES[intent] || TEMPLATES.general;
  return pilihVarian(variants, userInput);
}

module.exports = { getTemplate };
