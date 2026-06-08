'use strict';

/**
 * nlgGenerator.js
 * ───────────────
 * Orkestrasi NLG rule-based:
 *   1. Ekstrak context (ctx) dari processed_data
 *   2. Klasifikasi intent dari pertanyaan pengguna
 *   3. Pilih template yang sesuai (min. 3 varian / intent)
 *   4. Isi template dengan data faktual → paragraf Markdown
 *
 * Faktual accuracy 100% dijamin karena semua angka berasal
 * langsung dari hasil kueri Oracle — tidak ada yang di-generate.
 */

const { classify }    = require('./intentClassifier');
const { getTemplate } = require('./templateLibrary');

// ── Label map ──────────────────────────────────────────────────────────────────

const RULE_SUBJEK = {
  ps_001: 'total order HSI (Bisnis dan Basic)',
  ps_002: 'order HSI berdasarkan distribusi regional',
  ps_003: 'order HSI per kategori bandwidth',
  ps_004: 'penetrasi HSI per wilayah',
  ps_005: 'cakupan layanan per STO',
  ps_006: 'tingkat keberhasilan fulfillment order HSI',
  ps_007: 'rata-rata durasi instalasi layanan HSI',
  ps_008: 'revenue HSI per kategori bandwidth',
  ps_009: 'performa saluran penjualan HSI',
  ps_010: 'penetrasi produk digital pada layanan HSI',
  ps_011: 'pertumbuhan order HSI',
  ps_012: 'order HSI berdasarkan struktur geografis',
  mart_001: 'tren revenue layanan HSI',
  mart_002: 'performa revenue HSI per regional',
  mart_003: 'siklus hidup pelanggan HSI',
  mart_004: 'revenue recurring HSI',
  mart_005: 'klasifikasi revenue HSI per akun GL',
  mart_006: 'hirarki layanan HSI',
  mart_007: 'pola perilaku pelanggan HSI',
  mart_008: 'revenue HSI lintas wilayah geografis',
  target_001: 'realisasi HSI terhadap target',
  target_002: 'segmentasi pencapaian target HSI',
  target_003: 'performa regional HSI terhadap target',
  target_004: 'tren pertumbuhan realisasi vs target HSI',
  target_005: 'posisi kompetitif HSI terhadap target pasar',
  dapros_001: 'segmentasi pelanggan HSI',
  dapros_002: 'bundle layanan HSI dan produk tambahan',
  dapros_003: 'profil transformasi digital pelanggan HSI',
  dapros_004: 'profil pendapatan pelanggan HSI',
  dapros_005: 'distribusi geografis pelanggan HSI',
  dapros_006: 'distribusi kecepatan layanan HSI',
  dapros_007: 'loyalitas dan tenure pelanggan HSI',
  ct0_ebis_001: 'tingkat churn internet per regional',
  ct0_001: 'churn pelanggan HSI (CT0)',
  ct0_002: 'pola churn berdasarkan masa layanan HSI',
  ct0_003: 'pola churn berdasarkan bandwidth HSI',
  ct0_004: 'performa churn per witel',
  ct0_005: 'pola churn bulanan dan kuartalan HSI',
  ct0_006: 'perbandingan churn antar divisi HSI',
};

function getSubjek(rule) {
  return RULE_SUBJEK[rule.RULE_META.RULE_ID] ||
    rule.RULE_META.DESCRIPTION.toLowerCase();
}

// ── Format Bulan Indonesia ─────────────────────────────────────────────────────

const BULAN_ID = ['','Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];

function parsePeriode(str) {
  if (!str) return str;
  // "April 2025" → already formatted, return as-is
  if (/[a-zA-Z]/.test(str)) return str;
  // "2025-04" → "April 2025"
  const [y, m] = str.split('-');
  return `${BULAN_ID[parseInt(m, 10)] || m} ${y}`;
}

// ── Tabel Markdown dari array objek ───────────────────────────────────────────

const SKIP_COLS = new Set(['tahun','bulan','tahun_str','bulan_str']);

function arrayToTable(arr, maxRows = 12) {
  if (!arr || arr.length === 0) return '';
  const keys = Object.keys(arr[0]).filter(k => !SKIP_COLS.has(k));
  if (keys.length === 0) return '';
  const toLabel = k => k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\bHsi\b/g, 'HSI').replace(/\bMom\b/g, 'MoM').replace(/\bYoy\b/g, 'YoY');
  const fmt = v => (v === null || v === undefined) ? '-' :
    (typeof v === 'number' ? v.toLocaleString('id-ID') : String(v).replace(/_/g, ' '));
  const header = `| ${keys.map(toLabel).join(' | ')} |`;
  const sep    = `| ${keys.map(() => '---').join(' | ')} |`;
  const rows   = arr.slice(0, maxRows).map(r => `| ${keys.map(k => fmt(r[k])).join(' | ')} |`);
  const extra  = arr.length > maxRows ? `\n_… dan ${arr.length - maxRows} baris lainnya._` : '';
  return [header, sep, ...rows].join('\n') + extra;
}

// ── Ekstrak context dari processed_data ───────────────────────────────────────

function ambil(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return null;
}

function extractCtx(data, rule, recordCount, execTime, geoLabel = '') {
  const meta   = rule.RULE_META;
  const subjek = getSubjek(rule);
  // geoLabelPhrase: inserted after periode, e.g. " di **Witel Aceh**"
  const geoLabelPhrase = geoLabel ? ` di **${geoLabel}**` : '';
  // geoScopeWord: replaces "secara nasional" / "seluruh wilayah" when filtered
  const geoScopeWord   = geoLabel ? `di ${geoLabel}` : 'secara nasional';
  const ctx    = {
    periode: '', mainValue: '-', mainUnit: '', mainLabel: meta.DESCRIPTION,
    subjek, kategori: '',
    momValue: null, momKategori: null, momSelisih: null, yoyValue: null,
    breakdownProse: '', breakdownTable: '', hasBreakdown: false,
    bundlingProse: '', hasBundling: false,
    pelangganUnik: null, rataRataOrder: null, hasPelanggan: false,
    insightsBullets: '', hasInsights: false,
    trendProse: '', hasTrend: false,
    database: meta.DATABASE, recordCount, execTime,
    geoLabel, geoLabelPhrase, geoScopeWord,
  };

  if (!data || typeof data !== 'object' || Array.isArray(data)) return ctx;

  // ── Periode ───────────────────────────────────────────────────────────────────
  // Coba key root-level yang paling umum terlebih dahulu
  const pRaw = ambil(data, 'periode', 'periode_analisis', 'periode_data');
  ctx.periode = parsePeriode(typeof pRaw === 'string' ? pRaw : '') || '';

  // Fallback: periode di dalam ringkasan_eksekutif (ps_002, ps_003, ps_010, ps_011, ps_012)
  if (!ctx.periode) {
    const reks = ambil(data, 'ringkasan_eksekutif');
    if (reks && typeof reks === 'object') {
      const p2 = ambil(reks, 'periode', 'periode_analisis');
      if (typeof p2 === 'string') ctx.periode = parsePeriode(p2) || p2;
    }
  }

  // Fallback: detail_analisis[0].identitas_unit.periode (target_001 – target_005)
  if (!ctx.periode) {
    const firstDetail = Array.isArray(data.detail_analisis) && data.detail_analisis[0];
    const identitas   = firstDetail && firstDetail.identitas_unit;
    const p3          = identitas && ambil(identitas, 'periode', 'PERIODE');
    if (p3) ctx.periode = parsePeriode(String(p3));
  }

  // Kategori
  ctx.kategori = ambil(data,
    'kategori_volume','kategori_fulfillment','kategori_revenue','status_sla','status') || '';

  // ── summary_eksekutif (target_001 – target_005) ───────────────────────────────
  const sumEks = ambil(data, 'summary_eksekutif', 'summary_trend',
    'summary_regional', 'summary_segmen', 'summary_kompetitif');
  if (sumEks && typeof sumEks === 'object') {
    // Nilai utama: rata-rata pencapaian target
    const rataCap = ambil(sumEks,
      'rata_rata_pencapaian', 'rata_rata_achievement', 'rata_rata_pencapaian_pct',
      'rata_rata_competitive_strength');
    if (rataCap && ctx.mainValue === '-') {
      ctx.mainValue = String(rataCap).replace('%', '');
      ctx.mainUnit  = '%';
      ctx.mainLabel = 'Rata-Rata Pencapaian Target';
    }
    // Satuan dominan (SSL / UNIT / dll.)
    const satDom = ambil(sumEks, 'satuan_dominan');
    if (satDom && !ctx.mainUnit) ctx.mainUnit = satDom;

    // Unit capai target sebagai proxy "pelanggan"
    const unitCapai = ambil(sumEks, 'unit_capai_target', 'segmen_capai_target',
      'regional_capai_target');
    const totalUnit = ambil(sumEks, 'total_unit_analisis', 'total_segmen', 'total_regional');
    if (unitCapai !== null && totalUnit) {
      ctx.pelangganUnik = `${unitCapai} dari ${totalUnit} unit`;
      ctx.hasPelanggan  = true;
    }

    // Distribusi kategori performa sebagai breakdown
    const distKat = ambil(sumEks, 'distribusi_kategori', 'distribusi_posisi_kompetitif');
    if (distKat && typeof distKat === 'object' && !ctx.hasBreakdown) {
      const entri = Object.entries(distKat).filter(([, v]) => v > 0);
      if (entri.length > 0) {
        ctx.hasBreakdown = true;
        const KAT_LABEL  = {
          sangat_baik:   'Sangat Baik (≥ 110%)',
          baik:          'Baik (≥ 100%)',
          cukup:         'Cukup (≥ 90%)',
          kurang:        'Kurang (≥ 75%)',
          sangat_kurang: 'Sangat Kurang (< 75%)',
        };
        ctx.breakdownProse = entri
          .map(([k, v]) => `**${KAT_LABEL[k] || k.replace(/_/g, ' ')}** sebanyak ${v} unit`)
          .join(', ');
      }
    }
  }

  // ── Nilai utama ──────────────────────────────────────────────────────────────
  const ring = ambil(data, 'ringkasan_utama','ringkasan_fulfillment',
    'ringkasan_revenue','ringkasan_subscriber','ringkasan_churn','ringkasan_target');

  if (ring && typeof ring === 'object') {
    for (const [k, v] of Object.entries(ring)) {
      if (k === 'deskripsi' || k === 'kategori_volume') continue;
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        ctx.mainValue = String(v);
        ctx.mainLabel = k.replace(/_/g, ' ')
          .replace(/\b\w/g, c => c.toUpperCase())
          .replace(/\bHsi\b/g, 'HSI');
        break;
      }
    }
  }

  // Fallback: metrik_nasional / metrik_keseluruhan (mart_*, dapros_002, ps_008)
  if (ctx.mainValue === '-') {
    const metrik = ambil(data, 'metrik_nasional', 'metrik_keseluruhan');
    if (metrik && typeof metrik === 'object') {
      // Prioritaskan key yang mengandung "total" atau "revenue"
      const PRIO = ['total_revenue','total_order_hsi','total_order','total_pelanggan',
                    'total_churn','total_estimasi_revenue_bulanan','rata_rata_arpu'];
      let found = false;
      for (const pk of PRIO) {
        if (metrik[pk] !== undefined && metrik[pk] !== null) {
          ctx.mainValue = String(metrik[pk]);
          ctx.mainLabel = pk.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            .replace(/\bHsi\b/g, 'HSI');
          found = true; break;
        }
      }
      // Jika tidak ada key prioritas, ambil nilai pertama yang tersedia
      if (!found) {
        for (const [k, v] of Object.entries(metrik)) {
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            ctx.mainValue = String(v);
            ctx.mainLabel = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              .replace(/\bHsi\b/g, 'HSI');
            break;
          }
        }
      }
    }
  }

  // Fallback: ringkasan_eksekutif (ps_002, ps_003, ps_010, ps_011, ps_012)
  if (ctx.mainValue === '-') {
    const reks = ambil(data, 'ringkasan_eksekutif');
    if (reks && typeof reks === 'object') {
      const PRIO = ['total_order_hsi','total_order','total_revenue','total_pelanggan',
                    'total_churn','total_order_digital','total_estimasi_revenue_bulanan'];
      for (const pk of PRIO) {
        if (reks[pk] !== undefined && reks[pk] !== null) {
          ctx.mainValue = String(reks[pk]);
          ctx.mainLabel = pk.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            .replace(/\bHsi\b/g, 'HSI');
          break;
        }
      }
    }
  }

  // Fallback: total_pelanggan_dianalisis at root (dapros_* rules)
  if (ctx.mainValue === '-') {
    const totalPel = ambil(data, 'total_pelanggan_dianalisis');
    if (totalPel !== null && totalPel !== undefined) {
      ctx.mainValue = String(totalPel);
      ctx.mainLabel = 'Total Pelanggan';
      ctx.mainUnit  = 'pelanggan';
    }
  }

  // Fallback: total_unit_dianalisis / total_periode_dianalisis / total_wilayah_analisis
  // (ps_006 fulfillment, ps_012 growth trend, ps_004 penetrasi)
  if (ctx.mainValue === '-') {
    const totalUnit = ambil(data,
      'total_unit_dianalisis', 'total_periode_dianalisis', 'total_wilayah_analisis');
    if (totalUnit !== null && totalUnit !== undefined) {
      ctx.mainValue = String(totalUnit);
      ctx.mainLabel = 'Total Unit Dianalisis';
      ctx.mainUnit  = 'unit';
    }
  }

  // ── Pertumbuhan ──────────────────────────────────────────────────────────────
  const tumbuh = ambil(data, 'analisis_pertumbuhan');
  if (tumbuh && typeof tumbuh === 'object') {
    const mom = ambil(tumbuh, 'order_bulanan','bulanan','mom');
    const yoy = ambil(tumbuh, 'tahunan','yoy');
    if (mom && typeof mom === 'object') {
      ctx.momValue    = ambil(mom, 'persentase');
      ctx.momKategori = ambil(mom, 'kategori');
      ctx.momSelisih  = ambil(mom, 'selisih_order','selisih');
    }
    if (yoy && typeof yoy === 'object') {
      const pct = ambil(yoy, 'persentase');
      if (pct && pct !== 'Belum tersedia') ctx.yoyValue = pct;
    }
  }

  // ── Breakdown produk (prosa jika ≤ 4, tabel jika > 4) ───────────────────────
  const bdwn = ambil(data, 'breakdown_produk','breakdown_segmen','distribusi_produk',
    'distribusi_segmen_utama','karakteristik_pasar','distribusi_bundle_layanan',
    'distribusi_performa');
  if (bdwn && typeof bdwn === 'object' && !Array.isArray(bdwn)) {
    const entri = Object.entries(bdwn);
    if (entri.length > 0) {
      ctx.hasBreakdown = true;
      if (entri.length <= 4) {
        ctx.breakdownProse = entri.map(([k, v]) => {
          const label = k.replace(/_/g, ' ').toUpperCase().includes('HSI')
            ? k.toUpperCase() : k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          if (typeof v === 'object' && v !== null) {
            const jml = v.jumlah_order || v.jumlah || v.total;
            const pct = v.persentase;
            if (jml && pct) return `**${label}** sebanyak ${jml} (${pct})`;
            if (jml)        return `**${label}** sebanyak ${jml}`;
          }
          return `**${label}**: ${v}`;
        }).join(', serta ');
      } else {
        ctx.breakdownTable = arrayToTable(
          entri.map(([k, v]) => ({ Segmen: k, ...(typeof v === 'object' ? v : { Nilai: v }) }))
        );
        ctx.breakdownProse = 'berbagai segmen';
      }
    }
  }

  // ── Bundling ─────────────────────────────────────────────────────────────────
  const bund = ambil(data, 'analisis_bundling');
  if (bund && typeof bund === 'object') {
    const parts = [];
    const total = ambil(bund, 'total_bundling');
    if (total && typeof total === 'object') {
      const jml = ambil(total, 'jumlah'); const pct = ambil(total, 'persentase');
      if (jml) parts.push(`**${jml}** order bundling${pct ? ` (${pct})` : ''}`);
    }
    const digital = ambil(bund, 'digital_bundling');
    if (digital && typeof digital === 'object') {
      const djml = ambil(digital, 'total'); const dpct = ambil(digital, 'persentase');
      const detail = ambil(digital, 'breakdown');
      let kd = djml ? `bundling produk digital sebanyak **${djml}**${dpct ? ` (${dpct})` : ''}` : '';
      if (detail && typeof detail === 'object') {
        const prod = Object.entries(detail)
          .map(([k, v]) => `${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} ${v}`)
          .join(', ');
        if (prod) kd += ` dengan rincian: ${prod}`;
      }
      if (kd) parts.push(kd);
    }
    if (parts.length > 0) { ctx.bundlingProse = parts.join('; '); ctx.hasBundling = true; }
  }

  // ── Pelanggan ─────────────────────────────────────────────────────────────────
  const pel = ambil(data, 'metrik_pelanggan','ringkasan_pelanggan');
  if (pel && typeof pel === 'object') {
    const unik = ambil(pel, 'total_pelanggan_unik','total_pelanggan');
    const rata = ambil(pel, 'rata_rata_order_per_pelanggan','rata_rata');
    if (unik) {
      ctx.pelangganUnik  = String(unik);
      ctx.rataRataOrder  = rata ? String(rata) : null;
      ctx.hasPelanggan   = true;
    }
  }

  // Fallback: total_pelanggan_dianalisis / total_churn_dianalisis di root (dapros_*, ct0_*)
  if (!ctx.hasPelanggan) {
    const total = ambil(data,
      'total_pelanggan_dianalisis', 'total_churn_dianalisis',
      'total_sto_dianalisis', 'total_channel_aktif', 'total_kategori_bandwidth',
      'total_unit_dianalisis', 'total_periode_dianalisis', 'total_wilayah_analisis');
    if (total !== null) {
      ctx.pelangganUnik = String(total);
      ctx.hasPelanggan  = true;
    }
  }

  // ── Wawasan bisnis ────────────────────────────────────────────────────────────
  // Coba semua key insight yang digunakan di berbagai rule, urutan prioritas
  const wsKeys = [
    'wawasan_bisnis','insight','rekomendasi',               // ps_001, dapros_*
    'insight_strategis','insights_strategis',               // target_001, ps_010
    'insight_bisnis',                                       // mart_* (revenue rules)
    'insight_geografis', 'insight_prediktif',               // target_003, target_004
    'insights_bundling',                                    // ps_002
    'insight_utama',                                        // ps_005/006/008/009, ct0_*
    'wawasan_utama',                                        // ps_012
    'rekomendasi_strategis', 'rekomendasi_aksi',            // banyak rules
    'rekomendasi_kompetitif',                               // target_005
    'rekomendasi_prioritas',                                // ps_010
  ];
  for (const wsKey of wsKeys) {
    if (ctx.hasInsights) break;
    const ws = data[wsKey];
    if (!Array.isArray(ws) || ws.length === 0) continue;

    let bullets = [];
    // Format A: [{kategori, nilai}] — ps_001, dapros rules
    const katNilai = ws.filter(w => w && w.kategori && w.nilai)
      .map(w => `- **${w.kategori}**: ${w.nilai}`);
    if (katNilai.length > 0) { bullets = katNilai; }
    else {
      // Format B: [{tipe, nilai}] — ps_002 insights_bundling
      const tipeNilai = ws.filter(w => w && w.tipe && w.nilai)
        .map(w => `- **${w.tipe}**: ${w.nilai}`);
      if (tipeNilai.length > 0) { bullets = tipeNilai; }
      else {
        // Format C: string[] — mart_*, target_*, ct0_* (plain strings only; skip complex objects)
        bullets = ws.filter(w => typeof w === 'string' && w.trim()).map(w => `- ${w}`);
      }
    }
    if (bullets.length > 0) {
      ctx.insightsBullets = bullets.join('\n');
      ctx.hasInsights     = true;
    }
  }

  // ── Tren ─────────────────────────────────────────────────────────────────────
  const tr = ambil(data, 'tren_3_bulan','tren','ringkasan_tren');
  if (tr && typeof tr === 'string') {
    ctx.trendProse = tr.toLowerCase(); ctx.hasTrend = true;
  }

  return ctx;
}

// ── Entry point ────────────────────────────────────────────────────────────────

/**
 * Generate narasi Markdown dari hasil eksekusi rule.
 *
 * @param {Object} rule            - objek rule lengkap
 * @param {Object} executionResult - { data, processed_data, execution_time, record_count }
 * @param {string} userInput       - pertanyaan asli pengguna (untuk intent detection)
 * @returns {string}               - Markdown siap tampil di chat
 */
function generate(rule, executionResult, userInput, geoContext) {
  const meta        = rule.RULE_META;
  const recordCount = executionResult.record_count || 0;
  const execTime    = executionResult.execution_time || 0;
  const data        = executionResult.processed_data || executionResult.data;

  // Build a formatted geo label, e.g. "Witel Aceh" or "Regional 1"
  let geoLabel = '';
  if (geoContext && geoContext.scope !== 'nasional' && geoContext.dbValue) {
    const raw = geoContext.label || geoContext.dbValue;
    if (geoContext.scope === 'witel' && !/^witel\b/i.test(raw)) {
      geoLabel = `Witel ${raw}`;
    } else {
      geoLabel = raw;
    }
  }

  const judulGeo = geoLabel ? ` — ${geoLabel}` : '';
  const judul    = `## ${meta.DESCRIPTION}${judulGeo}`;

  if (recordCount === 0) {
    const scopeHint = geoLabel ? ` untuk ${geoLabel}` : '';
    return `${judul}\n\nTidak ditemukan data yang sesuai dengan kriteria pencarian${scopeHint}. ` +
      'Pastikan parameter periode dan wilayah yang digunakan sudah benar.';
  }

  // Data mentah (array of rows) — tidak ada formatIndonesianResponse
  if (Array.isArray(data)) {
    const tabel = arrayToTable(data);
    const scopeNote = geoLabel ? ` di **${geoLabel}**` : '';
    if (!tabel) {
      const scopeHint = geoLabel ? ` untuk ${geoLabel}` : '';
      return `${judul}\n\nData ditemukan${scopeHint} namun tidak dapat ditampilkan karena format tidak dikenali. ` +
        'Silakan hubungi administrator atau coba pertanyaan lain.';
    }
    const intro = `Hasil analisis ${getSubjek(rule)}${scopeNote} menampilkan **${recordCount} rekaman data** berikut.`;
    return [judul, intro, tabel].filter(Boolean).join('\n\n') +
      `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount} rekaman · ${execTime}\u00A0ms_`;
  }

  // ── Rule-specific rich renderers ─────────────────────────────────────────────
  const ruleId = meta.RULE_ID;
  if (ruleId === 'ps_002' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs002(data, judul, recordCount, execTime, meta);
  }

  // Data terstruktur → extract ctx → select template → generate
  const ctx      = extractCtx(data, rule, recordCount, execTime, geoLabel);
  const { intent } = classify(userInput || '');
  const template = getTemplate(intent, userInput || '');
  const body     = template(ctx);

  return `${judul}\n\n${body}`;
}

// ── ps_002 : Distribusi Order HSI per Struktur Geografis ─────────────────────

function generatePs002(data, judul, recordCount, execTime, meta) {
  const reks  = data.ringkasan_eksekutif || {};
  const hirar = data.struktur_hirarki    || {};
  const tumbuh = data.analisis_pertumbuhan || {};
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;

  const sections = [judul];

  // ── Ringkasan periode ───────────────────────────────────────────────────────
  const periode = reks.periode || '-';
  const totalOrder = reks.total_order_hsi || '-';
  const totalSTO   = reks.total_sto_aktif  || '-';
  const komp       = reks.komposisi_produk || {};
  sections.push(
    `Pada **${periode}**, tercatat **${totalOrder} order HSI** dari **${totalSTO} STO aktif** secara nasional.` +
    (komp.total_hsi_bisnis
      ? ` Komposisi: HSI Bisnis **${komp.total_hsi_bisnis}** order · HSI Basic **${komp.total_hsi_basic}** order.`
      : '')
  );

  // ── Distribusi per Regional ─────────────────────────────────────────────────
  const regData = hirar.regional || {};
  const regArr  = Object.values(regData);
  if (regArr.length > 0) {
    sections.push('### Distribusi per Regional');
    const rows = regArr.map(r => ({
      Regional: r.nama,
      'Total Order HSI': r.total_order_hsi,
      'Kontribusi Nasional': r.kontribusi_nasional,
      'MoM': r.pertumbuhan_mom,
      'YoY': r.pertumbuhan_yoy,
      'Bundling Rate': r.rata_rata_bundling,
      'STO Aktif': r.jumlah_sto_aktif,
    }));
    sections.push(arrayToTable(rows, 7));
  }

  // ── Top Witel ───────────────────────────────────────────────────────────────
  const topWitel = hirar.witel_terbaik || [];
  if (topWitel.length > 0) {
    sections.push('### Top Witel berdasarkan Volume Order');
    const rows = topWitel.map(w => ({
      'No.': w.ranking,
      Witel: w.nama_witel,
      Regional: w.regional,
      'Total Order HSI': w.total_order_hsi,
      'Bundling Rate': w.bundling_rate,
      'Avg MoM': w.avg_mom_growth,
      'Jumlah STO': w.jumlah_sto,
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // ── Pertumbuhan MoM & YoY ───────────────────────────────────────────────────
  const momOv = (tumbuh.mom_overview || {}).order_bulanan || {};
  const yoyOv = (tumbuh.yoy_overview || {}).order_tahunan || {};
  if (momOv.rata_rata_mom || yoyOv.rata_rata_yoy) {
    const parts = [];
    if (momOv.rata_rata_mom)
      parts.push(`Pertumbuhan MoM rata-rata **${momOv.rata_rata_mom}** (${momOv.sto_pertumbuhan_positif || 0} STO positif · status: ${momOv.status || '-'})`);
    if (yoyOv.rata_rata_yoy)
      parts.push(`Pertumbuhan YoY rata-rata **${yoyOv.rata_rata_yoy}** (${yoyOv.sto_pertumbuhan_positif || 0} STO positif · status: ${yoyOv.status || '-'})`);
    sections.push('### Tren Pertumbuhan');
    sections.push(parts.join('\n\n'));
  }

  // ── STO Tumbuh Tercepat ─────────────────────────────────────────────────────
  const growthLeaders = tumbuh.growth_leaders || [];
  if (growthLeaders.length > 0) {
    sections.push('### STO dengan Pertumbuhan Terbaik');
    const rows = growthLeaders.map(s => ({
      STO: s.sto,
      'Total Order': s.total_order,
      'MoM': s.mom_growth,
      'YoY': s.yoy_growth,
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // ── Bundling insights ────────────────────────────────────────────────────────
  const bund = data.insights_bundling || {};
  if (bund.rata_rata_bundling_nasional) {
    sections.push(
      `### Bundling\n` +
      `- Bundling rate nasional rata-rata: **${bund.rata_rata_bundling_nasional}**\n` +
      `- ${bund.sto_dengan_bundling_tinggi || '-'} · ${bund.sto_dengan_digital_bundling || '-'}\n` +
      (bund.korelasi_bundling_growth ? `- Korelasi: ${bund.korelasi_bundling_growth}\n` : '') +
      (bund.peluang ? `- ${bund.peluang}` : '')
    );
  }

  // ── Rekomendasi ─────────────────────────────────────────────────────────────
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    const bullets = reko
      .map(r => `- **${r.area}** _(${r.priority})_: ${r.rekomendasi}`)
      .join('\n');
    sections.push(`### Rekomendasi Strategis\n${bullets}`);
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

module.exports = { generate };
