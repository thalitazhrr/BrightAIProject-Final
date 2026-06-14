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

function formatItem(item, defaultLabel) {
  if (typeof item === 'string') {
    // Jika sudah ada bold, jangan diubah
    if (item.includes('**')) return `- ${item}`;
    
    // Ambil 2-3 kata pertama untuk dijadikan label (maksimal 3 kata)
    const words = item.split(' ');
    if (words.length <= 4) {
      return `- **${item}**`;
    }
    
    // Bikin Capitalized label
    const labelWords = words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const label = labelWords.join(' ');
    
    // Return format bold label tanpa mengulang kata di isinya
    // Tapi lebih aman kita kasih format: **Label**: text
    // Namun untuk menghindari pengulangan, kita bold saja beberapa kata pertama di kalimatnya
    const boldPart = words.slice(0, 2).join(' ');
    const restPart = words.slice(2).join(' ');
    return `- **${boldPart}** ${restPart}`;
  }
  
  if (defaultLabel === 'Insight') {
    return `- **${item.kategori || item.area || defaultLabel}**: ${item.nilai || item.insight || item.rekomendasi || item.deskripsi || '-'}`;
  } else {
    return `- **${item.area || item.kategori || defaultLabel}**: ${item.rekomendasi || item.nilai || item.insight || item.deskripsi || '-'}`;
  }
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

  if (ruleId === 'ps_003' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs003(data, judul, recordCount, execTime, meta);
  }

  if (ruleId === 'ps_004' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs004(data, judul, recordCount, execTime, meta);
  }

  if (ruleId === 'ps_005' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs005(data, judul, recordCount, execTime, meta);
  }

  if (ruleId === 'ps_006' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs006(data, judul, recordCount, execTime, meta);
  }

  if (ruleId === 'ps_007' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs007(data, judul, recordCount, execTime, meta);
  }

  if (ruleId === 'ps_008' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs008(data, judul, recordCount, execTime, meta);
  }

  if (ruleId === 'ps_009' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs009(data, judul, recordCount, execTime, meta);
  }

  if (ruleId === 'ps_010' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs010(data, judul, recordCount, execTime, meta);
  }

  if (ruleId === 'ps_011' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs011(data, judul, recordCount, execTime, meta);
  }

  if (ruleId === 'ps_012' && data && typeof data === 'object' && !Array.isArray(data)) {
    return generatePs012(data, judul, recordCount, execTime, meta);
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

// ── ps_003 : Distribusi Order HSI per Kategori Bandwidth ─────────────────────

function generatePs003(data, judul, recordCount, execTime, meta) {
  const reks   = data.ringkasan_eksekutif || {};
  const trend  = data.trend_pasar || {};
  const highl  = data.highlights || {};
  const detail = data.distribusi_detail || [];
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;

  const sections = [judul];

  // ── Ringkasan Eksekutif ───────────────────────────────────────────────────
  const periode   = reks.periode || '-';
  const totalOrd  = reks.total_order_analyzed || '-';
  const totalSvc  = reks.total_layanan_hsi || '-';
  const jmlKat    = reks.jumlah_kategori || '-';
  sections.push(
    `Pada **${periode}**, terdapat **${totalOrd} order HSI** yang dianalisis ` +
    `dari **${totalSvc} layanan unik** yang tersebar di **${jmlKat} kategori bandwidth**. ` +
    `Komposisi: HSI Bisnis **${reks.total_hsi_bisnis || '-'}** · HSI Basic **${reks.total_hsi_basic || '-'}**.`
  );

  // ── Karakteristik Pasar ───────────────────────────────────────────────────
  if (trend.bandwidth_rata_rata_tertimbang) {
    sections.push(
      `### Karakteristik Pasar\n` +
      `- Bandwidth rata-rata tertimbang: **${trend.bandwidth_rata_rata_tertimbang}**\n` +
      `- Arah pasar: **${trend.karakteristik_pasar || '-'}**\n` +
      `- Penetrasi premium: **${trend.penetrasi_premium || '-'}**\n` +
      `- Dominasi HSI Bisnis: **${trend.dominasi_hsi_bisnis || '-'}**`
    );
  }

  // ── Highlights ────────────────────────────────────────────────────────────
  const pop = highl.kategori_terpopuler;
  const bun = highl.kategori_bundling_terbaik;
  if (pop || bun) {
    const parts = [];
    if (pop) {
      parts.push(
        `- **Kategori Terpopuler**: ${pop.nama} — pangsa pasar **${pop.pangsa_pasar}** ` +
        `(${pop.total_order} order, ${pop.total_layanan || '-'} layanan) · ${pop.product_mix}`
      );
    }
    if (bun) {
      parts.push(
        `- **Bundling Terbaik**: ${bun.nama} — bundling rate **${bun.bundling_rate}** · digital **${bun.digital_bundling}**`
      );
    }
    const eff = highl.kategori_paling_efisien;
    if (eff) {
      parts.push(
        `- **Paling Efisien**: ${eff.nama} — ${eff.efisiensi} · ${eff.penetrasi} layanan/customer`
      );
    }
    sections.push(`### Highlights\n${parts.join('\n')}`);
  }

  // ── Distribusi per Bandwidth Tier ─────────────────────────────────────────
  if (detail.length > 0) {
    sections.push('### Distribusi per Kategori Bandwidth');
    const rows = detail.map(d => {
      const kat = d.kategori || {};
      const ord = d.metrik_order || {};
      const bw  = d.karakteristik_bandwidth || {};
      const bdl = d.bundling_performance || {};
      return {
        'Kategori': kat.nama || '-',
        'Total Order': ord.total_hsi || '-',
        'Pangsa Pasar': ord.pangsa_pasar || '-',
        'HSI Bisnis': ord.hsi_bisnis || '-',
        'HSI Basic': ord.hsi_basic || '-',
        'Avg BW': bw.rata_rata || '-',
        'Bundling Rate': bdl.bundling_rate || '-',
        'Digital': bdl.digital_bundling_rate || '-',
      };
    });
    sections.push(arrayToTable(rows, detail.length));
  }

  // ── Rekomendasi Strategis ─────────────────────────────────────────────────
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    const bullets = reko
      .map(r => `- **${r.area}** _(${r.priority})_: ${r.rekomendasi}`)
      .join('\n');
    sections.push(`### Rekomendasi Strategis\n${bullets}`);
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

// ── ps_004 : Penetrasi HSI per Wilayah ───────────────────────────────────────

function generatePs004(data, judul, recordCount, execTime, meta) {
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;
  const sections = [judul];

  // ── Ringkasan ─────────────────────────────────────────────────────────────
  const periode = data.periode_analisis || {};
  const tahun   = (periode.tahun_tersedia || []).join(', ') || '-';
  const bulan   = (periode.bulan_tersedia || []).join(', ') || '-';
  sections.push(
    `Analisis penetrasi HSI mencakup **${(data.total_wilayah_analisis || 0).toLocaleString('id-ID')} wilayah (STO)** ` +
    `pada tahun ${tahun} (bulan ${bulan}).`
  );

  // ── Top 5 Regional ────────────────────────────────────────────────────────
  const topNas = (data.top_performers || {}).nasional || {};
  const topReg = topNas.top_5_regional || [];
  if (topReg.length > 0) {
    sections.push('### Top Regional berdasarkan Penetrasi');
    const rows = topReg.map(r => ({
      'Regional': r.regional,
      'Avg Penetrasi': `${r.rata_rata_penetrasi}%`,
      'Total Order HSI': (r.total_volume || 0).toLocaleString('id-ID'),
      'Pelanggan Unik': (r.total_pelanggan_unik || 0).toLocaleString('id-ID'),
      'Layanan HSI': (r.total_layanan_hsi || 0).toLocaleString('id-ID'),
      'STO Terbaik': r.sto_terbaik || '-',
      'Penetrasi STO': `${r.penetrasi_sto_terbaik}%`,
    }));
    sections.push(arrayToTable(rows, topReg.length));
  }

  // ── Top 10 STO Penetrasi Tertinggi ────────────────────────────────────────
  const top10 = data.top_10_penetrasi_terkini || [];
  if (top10.length > 0) {
    sections.push('### Top 10 STO Penetrasi Tertinggi');
    const rows = top10.map(d => {
      const id = d.identitas_wilayah || {};
      const mp = d.metrik_penetrasi || {};
      const mf = d.metrik_fundamental || {};
      return {
        'STO': id.sto || '-',
        'Witel': id.witel || '-',
        'Regional': id.regional || '-',
        'Penetrasi Order': mp.penetrasi_hsi_order || '-',
        'Penetrasi Plg': mp.penetrasi_hsi_pelanggan || '-',
        'Total Order HSI': mp.pesanan_hsi_total || '-',
        'Pelanggan Unik': mf.total_pelanggan_unik || '-',
      };
    });
    sections.push(arrayToTable(rows, top10.length));
  }

  // ── Wilayah Potensial ─────────────────────────────────────────────────────
  const potensial = data.wilayah_potensial || [];
  if (potensial.length > 0) {
    sections.push(`### Wilayah Potensial (${potensial.length} STO)`);
    const rows = potensial.slice(0, 5).map(d => {
      const id = d.identitas_wilayah || {};
      const mp = d.metrik_penetrasi || {};
      const ap = d.analisis_pasar || {};
      return {
        'STO': id.sto || '-',
        'Witel': id.witel || '-',
        'Penetrasi': mp.penetrasi_hsi_order || '-',
        'Peluang': ap.peluang_pasar || '-',
        'Fase Pasar': ap.kematangan_pasar || '-',
      };
    });
    sections.push(arrayToTable(rows, rows.length));
  }

  // ── Rekomendasi ───────────────────────────────────────────────────────────
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    const bullets = reko.map(r => formatItem(r, 'Rekomendasi')).join('\n');
    sections.push(`### Rekomendasi Strategis\n${bullets}`);
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

// ── ps_005 : Coverage & Performa STO ──────────────────────────────────────────

function generatePs005(data, judul, recordCount, execTime, meta) {
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;
  const sections = [judul];

  // Ringkasan
  const periode = data.periode_analisis || '3 bulan terakhir';
  const totalSTO = data.total_sto_dianalisis || '-';
  sections.push(
    `Analisis cakupan dan performa **${totalSTO} STO** pada periode **${periode}**.`
  );

  // Distribusi performa
  const distPerf = (data.distribusi_performa || {}).kategori_performa;
  if (distPerf && typeof distPerf === 'object') {
    const entries = Object.entries(distPerf).filter(([, v]) => v > 0);
    if (entries.length > 0) {
      sections.push('### Distribusi Performa STO');
      sections.push(entries.map(([k, v]) => `- **${k.replace(/_/g, ' ')}**: ${v} STO`).join('\n'));
    }
  }

  // STO Unggulan
  const unggulan = (data.sto_unggulan || {}).performa_terbaik || [];
  if (unggulan.length > 0) {
    sections.push('### STO dengan Performa Terbaik');
    const rows = unggulan.map(s => ({
      'STO': s.sto || '-',
      'Witel': s.witel || '-',
      'Penetrasi Order': s.penetrasi_order_hsi || '-',
      'Success Rate': s.tingkat_keberhasilan || '-',
      'Skor Efisiensi': s.skor_efisiensi || '-',
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // STO perlu perbaikan
  const bottom = data.sto_perlu_perbaikan || [];
  if (bottom.length > 0) {
    sections.push('### STO Perlu Perbaikan');
    const rows = bottom.map(s => ({
      'STO': s.sto || '-',
      'Witel': s.witel || '-',
      'Penetrasi Order': s.penetrasi_order_hsi || '-',
      'Success Rate': s.tingkat_keberhasilan || '-',
      'Skor Efisiensi': s.skor_efisiensi || '-',
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // Insight utama
  const insights = data.insight_utama || [];
  if (insights.length > 0) {
    sections.push('### Wawasan Utama');
    sections.push(insights.map(w => formatItem(w, 'Insight')).join('\n'));
  }

  // Rekomendasi
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    sections.push('### Rekomendasi Strategis');
    sections.push(reko.map(r => formatItem(r, 'Rekomendasi')).join('\n'));
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

// ── ps_006 : Tingkat Keberhasilan Fulfillment ─────────────────────────────────

function generatePs006(data, judul, recordCount, execTime, meta) {
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;
  const sections = [judul];

  const periode = data.periode_analisis || '-';
  const totalUnit = data.total_unit_dianalisis || '-';
  sections.push(
    `Analisis fulfillment multi-dimensi mencakup **${totalUnit} unit** pada periode **${periode || '-'}**.`
  );

  // Distribusi performa
  const distPerf = data.distribusi_performa;
  if (distPerf && typeof distPerf === 'object') {
    const entries = Object.entries(distPerf).filter(([, v]) => v > 0);
    if (entries.length > 0) {
      sections.push('### Distribusi Kategori Performa');
      sections.push(entries.map(([k, v]) => `- **${k.replace(/_/g, ' ')}**: ${v} unit`).join('\n'));
    }
  }

  // Unit unggulan
  const unggulan = (data.unit_unggulan || {}).performa_terbaik || [];
  if (unggulan.length > 0) {
    sections.push('### Unit dengan Performa Terbaik');
    const rows = unggulan.map(u => ({
      'Regional': u.regional || '-',
      'Witel': u.witel || '-',
      'Success Rate': u.success_rate || '-',
      'Avg Fulfillment': u.avg_time || '-',
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // Unit perlu perhatian
  const bottom = data.unit_perlu_perhatian || [];
  if (bottom.length > 0) {
    sections.push('### Unit Perlu Perhatian');
    const rows = bottom.map(u => ({
      'Regional': u.regional || '-',
      'Witel': u.witel || '-',
      'Success Rate': u.success_rate || '-',
      'Avg Fulfillment': u.avg_time || '-',
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // Target KPI
  const kpi = data.target_kpi;
  if (kpi && typeof kpi === 'object') {
    sections.push('### Target KPI');
    sections.push(Object.entries(kpi).map(([k, v]) =>
      `- **${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}**: ${v || '-'}`
    ).join('\n'));
  }

  // Insight utama
  const insights = data.insight_utama || [];
  if (insights.length > 0) {
    sections.push('### Wawasan Utama');
    sections.push(insights.map(w => formatItem(w, 'Insight')).join('\n'));
  }

  // Rekomendasi
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    sections.push('### Rekomendasi Strategis');
    sections.push(reko.map(r => formatItem(r, 'Rekomendasi')).join('\n'));
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

// ── ps_007 : Analisis Waktu Instalasi ─────────────────────────────────────────

function generatePs007(data, judul, recordCount, execTime, meta) {
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;
  const sections = [judul];

  const totalSTO = data.total_sto_dianalisis || '-';
  sections.push(
    `Analisis waktu instalasi HSI multi-dimensional mencakup **${totalSTO} STO**.`
  );

  // Distribusi performa
  const distPerf = data.distribusi_performa;
  if (distPerf && typeof distPerf === 'object') {
    const entries = Object.entries(distPerf).filter(([, v]) => v > 0);
    if (entries.length > 0) {
      sections.push('### Distribusi Kategori Performa');
      sections.push(entries.map(([k, v]) => `- **${k.replace(/_/g, ' ')}**: ${v} STO`).join('\n'));
    }
  }

  // STO unggulan
  const tercepat = (data.sto_unggulan || {}).sto_tercepat || [];
  if (tercepat.length > 0) {
    sections.push('### STO dengan Instalasi Tercepat');
    const rows = tercepat.map(s => ({
      'STO': s.sto || '-',
      'Witel': s.witel || '-',
      'Avg Instalasi': s.rata_rata_waktu || '-',
      'Kepatuhan SLA': s.kepatuhan_sla || '-',
      'Customer SLA': s.customer_sla || '-',
      'Efisiensi': s.efisiensi || '-',
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // STO terlambat
  const terlambat = data.sto_terlambat || [];
  if (terlambat.length > 0) {
    sections.push('### STO dengan Instalasi Terlambat');
    const rows = terlambat.map(s => ({
      'STO': s.sto || '-',
      'Witel': s.witel || '-',
      'Avg Instalasi': s.rata_rata_waktu || '-',
      'Kepatuhan SLA': s.kepatuhan_sla || '-',
      'Customer SLA': s.customer_sla || '-',
      'Efisiensi': s.efisiensi || '-',
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // Target SLA
  const sla = data.target_sla;
  if (sla && typeof sla === 'object') {
    sections.push('### Target SLA');
    sections.push(Object.entries(sla).map(([k, v]) =>
      `- **${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}**: ${v || '-'}`
    ).join('\n'));
  }

  // Wawasan utama
  const insights = data.wawasan_utama || [];
  if (insights.length > 0) {
    sections.push('### Wawasan Utama');
    sections.push(insights.map(w => formatItem(w, 'Insight')).join('\n'));
  }

  // Rekomendasi
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    sections.push('### Rekomendasi Strategis');
    sections.push(reko.map(r => formatItem(r, 'Rekomendasi')).join('\n'));
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

// ── ps_008 : Revenue HSI per Kategori Bandwidth ──────────────────────────────

function generatePs008(data, judul, recordCount, execTime, meta) {
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;
  const sections = [judul];

  const periode = data.periode_data || '-';
  const totalKat = data.total_kategori_bandwidth || '-';
  const mk = data.metrik_keseluruhan || {};
  sections.push(
    `Analisis revenue HSI mencakup **${totalKat} kategori bandwidth** pada periode **${periode || '-'}**. ` +
    `Total estimasi revenue bulanan: **${mk.total_estimasi_revenue_bulanan || '-'}** · ` +
    `Order HSI: **${mk.total_order_hsi || '-'}** · Pelanggan HSI: **${mk.total_pelanggan_hsi || '-'}**.`
  );

  // Kategori revenue teratas
  const topKat = data.kategori_revenue_teratas || [];
  if (topKat.length > 0) {
    sections.push('### Kategori Revenue Teratas');
    const rows = topKat.map(k => ({
      'Kategori': k.kategori || '-',
      'Kontribusi Revenue': k.kontribusi_revenue || '-',
      'ARPU Estimasi': k.arpu_estimasi || '-',
      'Total Pelanggan': k.total_pelanggan || '-',
      'Total Order': k.total_order || '-',
      'Total Layanan': k.total_layanan || '-',
    }));
    sections.push(arrayToTable(rows, 8));
  }

  // Detail kategori (table of all)
  const detail = data.detail_kategori || [];
  if (detail.length > 0 && topKat.length === 0) {
    sections.push('### Detail per Kategori Bandwidth');
    const rows = detail.map(d => ({
      'Kategori': d.kategori_bandwidth || '-',
      'Revenue': (d.metrik_revenue || {}).total_revenue_bulanan_estimasi || '-',
      'ARPU': (d.metrik_revenue || {}).arpu_final_estimasi || '-',
      'Kontribusi': (d.metrik_revenue || {}).kontribusi_revenue || '-',
      'Order HSI': (d.metrik_hsi || {}).total_order_hsi || '-',
    }));
    sections.push(arrayToTable(rows, 10));
  }

  // Insight utama
  const insights = data.insight_utama || [];
  if (insights.length > 0) {
    sections.push('### Wawasan Utama');
    sections.push(insights.map(w => formatItem(w, 'Insight')).join('\n'));
  }

  // Rekomendasi
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    sections.push('### Rekomendasi Strategis');
    sections.push(reko.map(r => formatItem(r, 'Rekomendasi')).join('\n'));
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

// ── ps_009 : Performa Channel Penjualan HSI ──────────────────────────────────

function generatePs009(data, judul, recordCount, execTime, meta) {
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;
  const sections = [judul];

  const periode = data.periode_analisis || '-';
  const totalCh = data.total_channel_aktif || '-';
  const totalOrd = data.total_order_hsi || '-';
  sections.push(
    `Analisis performa **${totalCh} channel** penjualan HSI pada periode **${periode || '-'}** ` +
    `dengan total **${totalOrd} order HSI**.`
  );

  // Top 5 performers
  const top5 = data.top_5_performers || [];
  if (top5.length > 0) {
    sections.push('### Top 5 Channel Performers');
    const rows = top5.map(ch => ({
      'Channel': ch.channel || '-',
      'Kategori': ch.kategori || '-',
      'Pangsa Pasar': ch.market_share || '-',
      'Konversi': ch.conversion_rate || '-',
      'Skor Efektivitas': ch.effectiveness_score || '-',
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // Benchmark KPI
  const bench = data.benchmark_kpi;
  if (bench && typeof bench === 'object') {
    sections.push('### Benchmark KPI');
    sections.push(Object.entries(bench).map(([k, v]) =>
      `- **${k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}**: ${v || '-'}`
    ).join('\n'));
  }

  // Insight utama
  const insights = data.insight_utama || [];
  if (insights.length > 0) {
    sections.push('### Wawasan Utama');
    sections.push(insights.map(w => formatItem(w, 'Insight')).join('\n'));
  }

  // Rekomendasi
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    sections.push('### Rekomendasi Strategis');
    sections.push(reko.map(r => formatItem(r, 'Rekomendasi')).join('\n'));
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

// ── ps_010 : Penetrasi Produk Digital ─────────────────────────────────────────

function generatePs010(data, judul, recordCount, execTime, meta) {
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;
  const sections = [judul];

  const reks = data.ringkasan_eksekutif || {};
  const periode = reks.periode_analisis || '-';
  sections.push(
    `Analisis penetrasi **${reks.total_produk_digital || '-'} produk digital** pada periode **${periode || '-'}**. ` +
    `Total order digital: **${reks.total_order_digital || '-'}** · Customer digital: **${reks.total_customer_digital || '-'}** · ` +
    `Dampak revenue: **${reks.total_dampak_revenue || '-'}**.`
  );

  // Distribusi adopsi
  const distAdopsi = reks.distribusi_adopsi;
  if (distAdopsi && typeof distAdopsi === 'object') {
    const entries = Object.entries(distAdopsi).filter(([, v]) => v > 0);
    if (entries.length > 0) {
      sections.push('### Distribusi Kategori Adopsi');
      sections.push(entries.map(([k, v]) => `- **${k.replace(/_/g, ' ')}**: ${v} produk`).join('\n'));
    }
  }

  // Top performers
  const topPerf = data.top_performers || [];
  if (topPerf.length > 0) {
    sections.push('### Produk Digital dengan Performa Terbaik');
    const rows = topPerf.map(p => ({
      'Produk': p.product || '-',
      'Kategori': p.kategori || '-',
      'Penetrasi Customer': p.penetrasi_customer || '-',
      'Order Digital': p.orders || '-',
      'Dampak Revenue': p.revenue_impact || '-',
    }));
    sections.push(arrayToTable(rows, 5));
  }

  // Insights strategis
  const insights = data.insights_strategis || [];
  if (insights.length > 0) {
    sections.push('### Wawasan Strategis');
    sections.push(insights.map(w => formatItem(w, 'Insight')).join('\n'));
  }

  // Rekomendasi prioritas
  const reko = data.rekomendasi_prioritas || [];
  if (reko.length > 0) {
    sections.push('### Rekomendasi Prioritas');
    sections.push(reko.map(r => formatItem(r, 'Rekomendasi')).join('\n'));
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

// ── ps_011 : Pola Musiman Order HSI ──────────────────────────────────────────

function generatePs011(data, judul, recordCount, execTime, meta) {
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;
  const sections = [judul];

  const reks = data.ringkasan_eksekutif || {};
  const periode = reks.periode_analisis || '-';
  sections.push(
    `Analisis pola musiman mencakup **${reks.total_bulan_analisis || '-'} bulan** pada periode **${periode || '-'}**. ` +
    `Bulan puncak: **${reks.bulan_puncak || '-'}** · Bulan rendah: **${reks.bulan_rendah || '-'}**.`
  );

  // Pola musiman: puncak & lembah
  const pola = data.pola_musiman || {};
  const puncak = pola.puncak_aktivitas || [];
  const lembah = pola.lembah_aktivitas || [];
  if (puncak.length > 0 || lembah.length > 0) {
    sections.push('### Pola Musiman');
    if (puncak.length > 0) sections.push(`- **Puncak aktivitas**: ${puncak.join(', ')}`);
    if (lembah.length > 0) sections.push(`- **Lembah aktivitas**: ${lembah.join(', ')}`);
  }

  // Insights pola
  const polaInsights = pola.insights_pola || [];
  if (polaInsights.length > 0) {
    sections.push('### Wawasan Pola');
    sections.push(polaInsights.map(w => formatItem(w, 'Insight')).join('\n'));
  }

  // Detail bulanan (table of monthly data)
  const detail = data.detail_bulanan || [];
  if (detail.length > 0) {
    sections.push('### Ringkasan Bulanan');
    const rows = detail.map(d => ({
      'Bulan': (d.identitas_bulan || {}).nama_bulan || '-',
      'Kategori': (d.identitas_bulan || {}).kategori_musiman || '-',
      'Avg Order HSI': (d.metrik_hsi || {}).rata_rata_order_hsi || '-',
      'Success Rate': (d.metrik_performa || {}).tingkat_keberhasilan || '-',
      'Bundling': (d.metrik_performa || {}).tingkat_bundling || '-',
      'Indeks Volume': (d.indeks_musiman || {}).indeks_volume_order || '-',
    }));
    sections.push(arrayToTable(rows, 12));
  }

  // Rekomendasi
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    sections.push('### Rekomendasi Strategis');
    sections.push(reko.map(r => formatItem(r, 'Rekomendasi')).join('\n'));
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

// ── ps_012 : Tren Pertumbuhan Order HSI ──────────────────────────────────────

function generatePs012(data, judul, recordCount, execTime, meta) {
  const footer = `\n\n---\n_Sumber: ${meta.DATABASE} · ${recordCount.toLocaleString('id-ID')} rekaman · ${execTime}\u00A0ms_`;
  const sections = [judul];

  const totalPeriode = data.total_periode_dianalisis || '-';
  sections.push(
    `Analisis tren pertumbuhan HSI mencakup **${totalPeriode} periode** dengan multiple timeframes.`
  );

  // Tren terkini
  const terkini = data.tren_terkini || [];
  if (terkini.length > 0) {
    sections.push('### Tren Terkini');
    const rows = terkini.map(t => ({
      'Timeframe': (t.identitas_periode || {}).timeframe || '-',
      'Periode': (t.identitas_periode || {}).periode || '-',
      'Order HSI': (t.metrik_volume_hsi || {}).total_pesanan_hsi || '-',
      'Customer HSI': (t.metrik_volume_hsi || {}).total_customer_hsi || '-',
      'Growth Order': (t.analisis_pertumbuhan || {}).pertumbuhan_order_periode || '-',
      'Momentum': (t.analisis_pertumbuhan || {}).momentum_order || '-',
      'Kategori': (t.analisis_pertumbuhan || {}).kategori_tren || '-',
    }));
    sections.push(arrayToTable(rows, 8));
  }

  // Perbandingan timeframe
  const compare = data.perbandingan_timeframe;
  if (compare && typeof compare === 'object') {
    const entries = Object.entries(compare);
    if (entries.length > 0) {
      sections.push('### Perbandingan Timeframe');
      sections.push(entries.map(([k, v]) =>
        `- **${k.replace(/_/g, ' ')}**: ${typeof v === 'object' ? JSON.stringify(v) : (v || '-')}`
      ).join('\n'));
    }
  }

  // Pola pertumbuhan
  const pola = data.pola_pertumbuhan;
  if (pola && typeof pola === 'object') {
    const entries = Object.entries(pola);
    if (entries.length > 0) {
      sections.push('### Pola Pertumbuhan');
      sections.push(entries.map(([k, v]) =>
        `- **${k.replace(/_/g, ' ')}**: ${typeof v === 'object' ? JSON.stringify(v) : (v || '-')}`
      ).join('\n'));
    }
  }

  // Wawasan utama
  const insights = data.wawasan_utama || [];
  if (insights.length > 0) {
    sections.push('### Wawasan Utama');
    sections.push(insights.map(w => formatItem(w, 'Insight')).join('\n'));
  }

  // Rekomendasi
  const reko = data.rekomendasi_strategis || [];
  if (reko.length > 0) {
    sections.push('### Rekomendasi Strategis');
    sections.push(reko.map(r => formatItem(r, 'Rekomendasi')).join('\n'));
  }

  return sections.filter(Boolean).join('\n\n') + footer;
}

module.exports = { generate };
