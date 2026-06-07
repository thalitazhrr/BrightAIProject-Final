#!/usr/bin/env node
/**
 * eval_intent_classification.js
 * ─────────────────────────────
 * Evaluasi kuantitatif klasifikasi intent + rule matching.
 * Menghasilkan confusion matrix, precision, recall, F1
 * pada dua level: intent (8 kelas) dan rule (38 kelas).
 *
 * Jalankan:  node eval_intent_classification.js
 */

'use strict';

// ─── Stub logger agar rule files tidak crash ───
const path = require('path');
const loggerPath = path.join(__dirname, 'src/utils/logger.js');
require.cache[require.resolve(loggerPath)] = {
  id: loggerPath, filename: loggerPath, loaded: true,
  exports: { info(){}, warn(){}, error(){}, debug(){} }
};

const intentClassifier = require('./src/rules/engine/intentClassifier');
const ruleLoader       = require('./src/rules/engine/ruleLoader');
const QueryProcessor   = require('./src/rules/engine/queryProcessor');

// ─── Labeled test dataset ───
// Format: { query, expected_rule, expected_intent }
// expected_rule = null means we expect NO rule match (fallback)
const TEST_DATASET = [
  // ── ps_001: total_order_hsi ──
  { query: 'Berapa total order HSI bulan ini?', expected_rule: 'ps_001', expected_intent: 'quantity' },
  { query: 'Jumlah order HSI bisnis dan basic', expected_rule: 'ps_001', expected_intent: 'quantity' },
  { query: 'Total volume order internet broadband', expected_rule: 'ps_001', expected_intent: 'quantity' },
  { query: 'Berapa banyak order hsi bulan ini', expected_rule: 'ps_001', expected_intent: 'quantity' },
  { query: 'Total order hsi bisnis', expected_rule: 'ps_001', expected_intent: 'quantity' },

  // ── ps_002: order_per_struktur_geografis ──
  { query: 'Order HSI per wilayah regional', expected_rule: 'ps_002', expected_intent: 'location' },
  { query: 'Distribusi order HSI per regional', expected_rule: 'ps_002', expected_intent: 'location' },
  { query: 'Order HSI per struktur geografis', expected_rule: 'ps_002', expected_intent: 'location' },
  { query: 'Berapa order di masing-masing regional', expected_rule: 'ps_002', expected_intent: 'quantity' },

  // ── ps_003: order_per_bandwidth ──
  { query: 'Order HSI per bandwidth', expected_rule: 'ps_003', expected_intent: 'detail' },
  { query: 'Distribusi order berdasarkan kecepatan bandwidth', expected_rule: 'ps_003', expected_intent: 'detail' },
  { query: 'Berapa order HSI 20 Mbps', expected_rule: 'ps_003', expected_intent: 'quantity' },
  { query: 'Jumlah order per speed internet', expected_rule: 'ps_003', expected_intent: 'quantity' },

  // ── ps_004: penetrasi_hsi_wilayah ──
  { query: 'Penetrasi HSI per wilayah', expected_rule: 'ps_004', expected_intent: 'location' },
  { query: 'Berapa penetrasi layanan internet di regional 1', expected_rule: 'ps_004', expected_intent: 'quantity' },
  { query: 'Tingkat penetrasi HSI di wilayah witel', expected_rule: 'ps_004', expected_intent: 'location' },

  // ── ps_005: coverage_sto_analysis ──
  { query: 'Coverage STO HSI', expected_rule: 'ps_005', expected_intent: 'detail' },
  { query: 'Analisis jangkauan STO internet', expected_rule: 'ps_005', expected_intent: 'detail' },
  { query: 'Berapa cakupan STO HSI', expected_rule: 'ps_005', expected_intent: 'quantity' },

  // ── ps_006: fulfillment_success_rate ──
  { query: 'Tingkat keberhasilan fulfillment order HSI', expected_rule: 'ps_006', expected_intent: 'performance' },
  { query: 'Fulfillment success rate HSI', expected_rule: 'ps_006', expected_intent: 'performance' },
  { query: 'Berapa persen sukses instalasi HSI', expected_rule: 'ps_006', expected_intent: 'quantity' },

  // ── ps_008: revenue_per_bandwidth ──
  { query: 'Revenue HSI per bandwidth', expected_rule: 'ps_008', expected_intent: 'detail' },
  { query: 'Pendapatan per kecepatan bandwidth internet', expected_rule: 'ps_008', expected_intent: 'detail' },

  // ── ps_009: channel_performance_hsi ──
  { query: 'Performa channel penjualan HSI', expected_rule: 'ps_009', expected_intent: 'performance' },
  { query: 'Kinerja kanal penjualan order internet', expected_rule: 'ps_009', expected_intent: 'performance' },
  { query: 'Channel mana yang order HSI paling banyak', expected_rule: 'ps_009', expected_intent: 'quantity' },

  // ── ps_010: digital_product_penetration ──
  { query: 'Penetrasi produk digital HSI', expected_rule: 'ps_010', expected_intent: 'detail' },
  { query: 'Berapa pelanggan HSI yang pakai produk digital pijar', expected_rule: 'ps_010', expected_intent: 'quantity' },

  // ── ps_011: seasonal_pattern_analysis ──
  { query: 'Pola musiman order HSI', expected_rule: 'ps_011', expected_intent: 'trend' },
  { query: 'Tren seasonal penjualan HSI', expected_rule: 'ps_011', expected_intent: 'trend' },
  { query: 'Analisis musiman order bulanan HSI', expected_rule: 'ps_011', expected_intent: 'trend' },

  // ── ps_012: growth_trend_analysis ──
  { query: 'Tren pertumbuhan order HSI', expected_rule: 'ps_012', expected_intent: 'trend' },
  { query: 'Growth trend penjualan internet', expected_rule: 'ps_012', expected_intent: 'trend' },
  { query: 'Perkembangan order HSI bulan ke bulan MoM', expected_rule: 'ps_012', expected_intent: 'trend' },

  // ── mart_001: hsi_revenue_trend_analysis ──
  { query: 'Tren revenue HSI bulanan', expected_rule: 'mart_001', expected_intent: 'trend' },
  { query: 'Bagaimana tren pertumbuhan pendapatan HSI', expected_rule: 'mart_001', expected_intent: 'trend' },
  { query: 'Revenue trend layanan internet', expected_rule: 'mart_001', expected_intent: 'trend' },

  // ── mart_002: hsi_regional_performance_analysis ──
  { query: 'Performa revenue HSI per regional', expected_rule: 'mart_002', expected_intent: 'location' },
  { query: 'Kinerja pendapatan HSI per wilayah', expected_rule: 'mart_002', expected_intent: 'location' },

  // ── mart_003: hsi_customer_lifecycle_analysis ──
  { query: 'Analisis siklus hidup pelanggan HSI', expected_rule: 'mart_003', expected_intent: 'detail' },
  { query: 'Customer lifecycle revenue HSI', expected_rule: 'mart_003', expected_intent: 'detail' },

  // ── mart_004: hsi_revenue_scaling_strategy_analysis ──
  { query: 'Strategi peningkatan revenue HSI', expected_rule: 'mart_004', expected_intent: 'detail' },
  { query: 'Revenue scaling strategy internet HSI', expected_rule: 'mart_004', expected_intent: 'detail' },

  // ── mart_005: hsi_gl_account_revenue_classification ──
  { query: 'Klasifikasi revenue HSI per GL account', expected_rule: 'mart_005', expected_intent: 'detail' },
  { query: 'Revenue HSI berdasarkan akun GL', expected_rule: 'mart_005', expected_intent: 'detail' },

  // ── mart_006: hsi_service_hierarchy_portfolio_analysis ──
  { query: 'Portofolio layanan HSI', expected_rule: 'mart_006', expected_intent: 'detail' },
  { query: 'Service hierarchy revenue internet', expected_rule: 'mart_006', expected_intent: 'detail' },

  // ── mart_007: hsi_customer_behavior_pattern_analysis ──
  { query: 'Pola perilaku pelanggan HSI terhadap revenue', expected_rule: 'mart_007', expected_intent: 'detail' },
  { query: 'Customer behavior pattern revenue internet', expected_rule: 'mart_007', expected_intent: 'detail' },

  // ── mart_008: hsi_cross_geographic_revenue_analysis ──
  { query: 'Revenue HSI lintas wilayah geografis', expected_rule: 'mart_008', expected_intent: 'location' },
  { query: 'Pendapatan internet per regional lintas wilayah', expected_rule: 'mart_008', expected_intent: 'location' },

  // ── target_001: target_realisasi_hsi_performance ──
  { query: 'Realisasi target HSI', expected_rule: 'target_001', expected_intent: 'performance' },
  { query: 'Pencapaian target HSI bulan ini', expected_rule: 'target_001', expected_intent: 'performance' },
  { query: 'Berapa persen realisasi target internet', expected_rule: 'target_001', expected_intent: 'performance' },

  // ── target_002: hsi_segmentation_performance ──
  { query: 'Performa target HSI per segmentasi pelanggan', expected_rule: 'target_002', expected_intent: 'performance' },
  { query: 'Kinerja target HSI per segmen', expected_rule: 'target_002', expected_intent: 'performance' },

  // ── target_003: hsi_regional_performance ──
  { query: 'Performa target HSI per regional', expected_rule: 'target_003', expected_intent: 'performance' },
  { query: 'Pencapaian target HSI di setiap regional', expected_rule: 'target_003', expected_intent: 'performance' },

  // ── target_004: hsi_trend_growth_analysis ──
  { query: 'Tren pertumbuhan pencapaian target HSI', expected_rule: 'target_004', expected_intent: 'performance' },
  { query: 'Growth trend realisasi target internet', expected_rule: 'target_004', expected_intent: 'trend' },

  // ── target_005: hsi_competitive_performance ──
  { query: 'Performa kompetitif HSI antar regional', expected_rule: 'target_005', expected_intent: 'performance' },
  { query: 'Benchmarking pencapaian target HSI', expected_rule: 'target_005', expected_intent: 'performance' },

  // ── ct0_ebis_001: churn_rate_regional_analysis ──
  { query: 'Tingkat churn HSI per regional', expected_rule: 'ct0_ebis_001', expected_intent: 'location' },
  { query: 'Churn rate pelanggan internet per wilayah', expected_rule: 'ct0_ebis_001', expected_intent: 'location' },
  { query: 'Berapa churn HSI regional 1', expected_rule: 'ct0_ebis_001', expected_intent: 'quantity' },

  // ── ct0_002: ct0_pattern_masa_layanan_analysis ──
  { query: 'Pola churn berdasarkan masa layanan', expected_rule: 'ct0_002', expected_intent: 'detail' },
  { query: 'Analisis churn CT0 per durasi berlangganan', expected_rule: 'ct0_002', expected_intent: 'detail' },

  // ── ct0_ebis_003: bandwidth_churn_pattern_analysis ──
  { query: 'Pola churn berdasarkan bandwidth', expected_rule: 'ct0_ebis_003', expected_intent: 'detail' },
  { query: 'Churn pelanggan HSI per kecepatan bandwidth', expected_rule: 'ct0_ebis_003', expected_intent: 'detail' },

  // ── ct0_004: witel_churn_performance_analysis ──
  { query: 'Performa churn HSI per witel', expected_rule: 'ct0_004', expected_intent: 'location' },
  { query: 'Kinerja witel dalam mengelola churn internet', expected_rule: 'ct0_004', expected_intent: 'performance' },

  // ── ct0_005: monthly_quarterly_churn_pattern_analysis ──
  { query: 'Tren churn bulanan dan kuartalan HSI', expected_rule: 'ct0_005', expected_intent: 'trend' },
  { query: 'Pola churn CT0 per bulan dan kuartal', expected_rule: 'ct0_005', expected_intent: 'trend' },

  // ── ct0_006: divisi_churn_comparison_analysis ──
  { query: 'Perbandingan churn antar divisi', expected_rule: 'ct0_006', expected_intent: 'comparison' },
  { query: 'Bandingkan tingkat churn HSI bisnis dan consumer', expected_rule: 'ct0_006', expected_intent: 'comparison' },

  // ── dapros_001: hsi_customer_segmentation ──
  { query: 'Segmentasi pelanggan HSI', expected_rule: 'dapros_001', expected_intent: 'detail' },
  { query: 'Kategori pelanggan internet berdasarkan profil', expected_rule: 'dapros_001', expected_intent: 'detail' },

  // ── dapros_002: hsi_service_bundle_analysis ──
  { query: 'Analisis bundling layanan HSI', expected_rule: 'dapros_002', expected_intent: 'detail' },
  { query: 'Paket bundling pelanggan internet', expected_rule: 'dapros_002', expected_intent: 'detail' },

  // ── dapros_003: hsi_digital_transformation_profile ──
  { query: 'Profil transformasi digital pelanggan HSI', expected_rule: 'dapros_003', expected_intent: 'detail' },
  { query: 'Tingkat adopsi digital pelanggan internet', expected_rule: 'dapros_003', expected_intent: 'detail' },

  // ── dapros_004: hsi_revenue_profile_analysis ──
  { query: 'Profil revenue pelanggan HSI', expected_rule: 'dapros_004', expected_intent: 'detail' },
  { query: 'Analisis pendapatan per profil pelanggan internet', expected_rule: 'dapros_004', expected_intent: 'detail' },

  // ── dapros_005: hsi_geographic_distribution_profile ──
  { query: 'Distribusi geografis pelanggan HSI', expected_rule: 'dapros_005', expected_intent: 'location' },
  { query: 'Sebaran geografis pelanggan internet per wilayah', expected_rule: 'dapros_005', expected_intent: 'location' },

  // ── dapros_006: hsi_speed_distribution_analysis ──
  { query: 'Distribusi kecepatan internet pelanggan HSI', expected_rule: 'dapros_006', expected_intent: 'detail' },
  { query: 'Speed distribution pelanggan broadband', expected_rule: 'dapros_006', expected_intent: 'detail' },

  // ── dapros_007: hsi_customer_loyalty_analysis ──
  { query: 'Analisis loyalitas pelanggan HSI', expected_rule: 'dapros_007', expected_intent: 'detail' },
  { query: 'Tingkat loyalitas pelanggan internet', expected_rule: 'dapros_007', expected_intent: 'detail' },

  // ── Fallback / general ──
  { query: 'Cuaca hari ini bagaimana', expected_rule: null, expected_intent: 'general' },
  { query: 'Siapa presiden Indonesia', expected_rule: null, expected_intent: 'general' },
  { query: 'Hitung 2 + 2', expected_rule: null, expected_intent: 'general' },
  { query: 'Apa itu machine learning', expected_rule: null, expected_intent: 'general' },
  { query: 'Ceritakan tentang dirimu', expected_rule: null, expected_intent: 'general' },

  // ── Ambiguous / edge cases ──
  { query: 'HSI', expected_rule: null, expected_intent: 'general' },
  { query: 'order', expected_rule: null, expected_intent: 'general' },
  { query: 'Bagaimana performa revenue HSI bulan ini', expected_rule: 'mart_002', expected_intent: 'performance' },
  { query: 'Mengapa churn HSI meningkat di regional 3', expected_rule: 'ct0_ebis_001', expected_intent: 'reason' },
  { query: 'Bandingkan order HSI bisnis dan basic per regional', expected_rule: 'ps_001', expected_intent: 'comparison' },
];


// ─── Metrics Computation ───

function computeMetrics(yTrue, yPred, labels) {
  const n = yTrue.length;

  // Build confusion matrix
  const labelIdx = {};
  labels.forEach((l, i) => labelIdx[l] = i);
  const K = labels.length;
  const cm = Array.from({ length: K }, () => Array(K).fill(0));

  for (let i = 0; i < n; i++) {
    const ti = labelIdx[yTrue[i]];
    const pi = labelIdx[yPred[i]];
    if (ti !== undefined && pi !== undefined) {
      cm[ti][pi]++;
    }
  }

  // Per-class metrics
  const perClass = labels.map((label, idx) => {
    const tp = cm[idx][idx];
    const fp = cm.map(row => row[idx]).reduce((a, b) => a + b, 0) - tp;
    const fn = cm[idx].reduce((a, b) => a + b, 0) - tp;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall    = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1        = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
    const support   = cm[idx].reduce((a, b) => a + b, 0);
    return { label, tp, fp, fn, precision, recall, f1, support };
  });

  // Accuracy
  const correct = perClass.reduce((a, c) => a + c.tp, 0);
  const accuracy = correct / n;

  // Macro
  const activeCls = perClass.filter(c => c.support > 0);
  const macroP = activeCls.reduce((a, c) => a + c.precision, 0) / activeCls.length;
  const macroR = activeCls.reduce((a, c) => a + c.recall, 0) / activeCls.length;
  const macroF1 = activeCls.reduce((a, c) => a + c.f1, 0) / activeCls.length;

  // Weighted
  const totalSupport = activeCls.reduce((a, c) => a + c.support, 0);
  const weightedP  = activeCls.reduce((a, c) => a + c.precision * c.support, 0) / totalSupport;
  const weightedR  = activeCls.reduce((a, c) => a + c.recall * c.support, 0) / totalSupport;
  const weightedF1 = activeCls.reduce((a, c) => a + c.f1 * c.support, 0) / totalSupport;

  // Micro
  const microTP = perClass.reduce((a, c) => a + c.tp, 0);
  const microFP = perClass.reduce((a, c) => a + c.fp, 0);
  const microFN = perClass.reduce((a, c) => a + c.fn, 0);
  const microP  = microTP / (microTP + microFP || 1);
  const microR  = microTP / (microTP + microFN || 1);
  const microF1 = 2 * microP * microR / (microP + microR || 1);

  return {
    accuracy, n, correct,
    macro:    { precision: macroP, recall: macroR, f1: macroF1 },
    micro:    { precision: microP, recall: microR, f1: microF1 },
    weighted: { precision: weightedP, recall: weightedR, f1: weightedF1 },
    perClass, confusionMatrix: cm, labels
  };
}


// ─── Main ───

async function main() {
  console.log('='.repeat(70));
  console.log('  EVALUASI KUANTITATIF KLASIFIKASI INTENT & RULE MATCHING');
  console.log('  BrightAI Business Intelligence Chatbot');
  console.log('='.repeat(70));

  // Load rules
  const rules = await ruleLoader.loadAllRules();
  const rulesMap = new Map();
  rules.forEach(r => rulesMap.set(r.RULE_META.RULE_ID, r));
  console.log(`\nRules loaded: ${rulesMap.size}`);
  console.log(`Test queries: ${TEST_DATASET.length}\n`);

  // ─── Level 1: Intent Classification ───
  const intentTrue = [];
  const intentPred = [];

  // ─── Level 2: Rule Matching ───
  const ruleTrue  = [];
  const rulePred  = [];

  // Confidence tracking
  const confidences = { correct: [], incorrect: [], all: [] };
  let coverageCount = 0;  // queries reaching threshold 40

  const details = [];
  const startTime = Date.now();

  for (const tc of TEST_DATASET) {
    // Intent classification
    const ic = intentClassifier.classify(tc.query);
    intentTrue.push(tc.expected_intent);
    intentPred.push(ic.intent);

    // Rule matching
    const matchResult = await QueryProcessor.findMatchingRule(tc.query, rulesMap);
    const predictedRule = matchResult.success ? matchResult.rule.RULE_META.RULE_ID : null;

    ruleTrue.push(tc.expected_rule || '__NO_MATCH__');
    rulePred.push(predictedRule || '__NO_MATCH__');

    const ruleCorrect = predictedRule === tc.expected_rule;
    const conf = matchResult.success ? matchResult.confidence : 0;
    confidences.all.push(conf);
    if (ruleCorrect) confidences.correct.push(conf);
    else confidences.incorrect.push(conf);
    if (conf >= 40) coverageCount++;

    details.push({
      query: tc.query,
      expectedIntent: tc.expected_intent,
      predictedIntent: ic.intent,
      intentCorrect: ic.intent === tc.expected_intent,
      expectedRule: tc.expected_rule,
      predictedRule,
      ruleCorrect,
      confidence: conf
    });
  }

  const elapsed = Date.now() - startTime;

  // ═══════════════════════════════════════════
  // INTENT-LEVEL RESULTS
  // ═══════════════════════════════════════════
  const intentLabels = [...new Set([...intentTrue, ...intentPred])].sort();
  const intentMetrics = computeMetrics(intentTrue, intentPred, intentLabels);

  console.log('━'.repeat(70));
  console.log('  LEVEL 1: EVALUASI KLASIFIKASI INTENT (8 kelas)');
  console.log('━'.repeat(70));
  console.log(`\n  Akurasi: ${(intentMetrics.accuracy * 100).toFixed(2)}% (${intentMetrics.correct}/${intentMetrics.n})\n`);

  console.log('  Per-Intent Metrics:');
  console.log('  ' + '-'.repeat(66));
  console.log('  ' + 'Intent'.padEnd(15) + 'Precision'.padEnd(12) + 'Recall'.padEnd(12) + 'F1-Score'.padEnd(12) + 'Support');
  console.log('  ' + '-'.repeat(66));
  for (const c of intentMetrics.perClass) {
    if (c.support > 0) {
      console.log('  ' +
        c.label.padEnd(15) +
        c.precision.toFixed(4).padEnd(12) +
        c.recall.toFixed(4).padEnd(12) +
        c.f1.toFixed(4).padEnd(12) +
        String(c.support)
      );
    }
  }
  console.log('  ' + '-'.repeat(66));
  console.log('  ' + 'Macro avg'.padEnd(15) +
    intentMetrics.macro.precision.toFixed(4).padEnd(12) +
    intentMetrics.macro.recall.toFixed(4).padEnd(12) +
    intentMetrics.macro.f1.toFixed(4).padEnd(12) +
    String(intentMetrics.n)
  );
  console.log('  ' + 'Weighted avg'.padEnd(15) +
    intentMetrics.weighted.precision.toFixed(4).padEnd(12) +
    intentMetrics.weighted.recall.toFixed(4).padEnd(12) +
    intentMetrics.weighted.f1.toFixed(4).padEnd(12) +
    String(intentMetrics.n)
  );
  console.log('  ' + 'Micro avg'.padEnd(15) +
    intentMetrics.micro.precision.toFixed(4).padEnd(12) +
    intentMetrics.micro.recall.toFixed(4).padEnd(12) +
    intentMetrics.micro.f1.toFixed(4).padEnd(12) +
    String(intentMetrics.n)
  );

  // ═══════════════════════════════════════════
  // RULE-LEVEL RESULTS
  // ═══════════════════════════════════════════
  const ruleLabels = [...new Set([...ruleTrue, ...rulePred])].sort();
  const ruleMetrics = computeMetrics(ruleTrue, rulePred, ruleLabels);

  console.log('\n' + '━'.repeat(70));
  console.log('  LEVEL 2: EVALUASI PENCOCOKAN ATURAN (38 kelas + NO_MATCH)');
  console.log('━'.repeat(70));
  console.log(`\n  Akurasi: ${(ruleMetrics.accuracy * 100).toFixed(2)}% (${ruleMetrics.correct}/${ruleMetrics.n})\n`);

  console.log('  Per-Rule Metrics (hanya kelas dengan support > 0):');
  console.log('  ' + '-'.repeat(66));
  console.log('  ' + 'Rule'.padEnd(18) + 'Precision'.padEnd(12) + 'Recall'.padEnd(12) + 'F1-Score'.padEnd(12) + 'Support');
  console.log('  ' + '-'.repeat(66));
  for (const c of ruleMetrics.perClass) {
    if (c.support > 0) {
      console.log('  ' +
        c.label.padEnd(18) +
        c.precision.toFixed(4).padEnd(12) +
        c.recall.toFixed(4).padEnd(12) +
        c.f1.toFixed(4).padEnd(12) +
        String(c.support)
      );
    }
  }
  console.log('  ' + '-'.repeat(66));
  console.log('  ' + 'Macro avg'.padEnd(18) +
    ruleMetrics.macro.precision.toFixed(4).padEnd(12) +
    ruleMetrics.macro.recall.toFixed(4).padEnd(12) +
    ruleMetrics.macro.f1.toFixed(4).padEnd(12) +
    String(ruleMetrics.n)
  );
  console.log('  ' + 'Weighted avg'.padEnd(18) +
    ruleMetrics.weighted.precision.toFixed(4).padEnd(12) +
    ruleMetrics.weighted.recall.toFixed(4).padEnd(12) +
    ruleMetrics.weighted.f1.toFixed(4).padEnd(12) +
    String(ruleMetrics.n)
  );
  console.log('  ' + 'Micro avg'.padEnd(18) +
    ruleMetrics.micro.precision.toFixed(4).padEnd(12) +
    ruleMetrics.micro.recall.toFixed(4).padEnd(12) +
    ruleMetrics.micro.f1.toFixed(4).padEnd(12) +
    String(ruleMetrics.n)
  );

  // ═══════════════════════════════════════════
  // CONFIDENCE & COVERAGE
  // ═══════════════════════════════════════════
  console.log('\n' + '━'.repeat(70));
  console.log('  ANALISIS KEYAKINAN & CAKUPAN');
  console.log('━'.repeat(70));
  const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const med = arr => {
    if (arr.length === 0) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  console.log(`\n  Coverage Rate (conf >= 40): ${(coverageCount / TEST_DATASET.length * 100).toFixed(1)}% (${coverageCount}/${TEST_DATASET.length})`);
  console.log(`  Rata-rata keyakinan (semua)   : ${avg(confidences.all).toFixed(1)}`);
  console.log(`  Rata-rata keyakinan (benar)   : ${avg(confidences.correct).toFixed(1)}`);
  console.log(`  Rata-rata keyakinan (salah)   : ${avg(confidences.incorrect).toFixed(1)}`);
  console.log(`  Median keyakinan (benar)      : ${med(confidences.correct).toFixed(1)}`);
  console.log(`  Waktu total evaluasi          : ${elapsed} ms`);
  console.log(`  Waktu rata-rata per kueri     : ${(elapsed / TEST_DATASET.length).toFixed(2)} ms`);

  // ═══════════════════════════════════════════
  // ERROR ANALYSIS
  // ═══════════════════════════════════════════
  console.log('\n' + '━'.repeat(70));
  console.log('  ANALISIS KESALAHAN');
  console.log('━'.repeat(70));
  const errors = details.filter(d => !d.ruleCorrect);
  if (errors.length === 0) {
    console.log('\n  Tidak ada kesalahan pencocokan aturan!\n');
  } else {
    console.log(`\n  Total kesalahan rule matching: ${errors.length}/${details.length}\n`);
    for (const e of errors) {
      console.log(`  Query   : "${e.query}"`);
      console.log(`  Expected: rule=${e.expectedRule || 'NO_MATCH'}, intent=${e.expectedIntent}`);
      console.log(`  Got     : rule=${e.predictedRule || 'NO_MATCH'}, intent=${e.predictedIntent}, conf=${e.confidence}`);
      console.log('');
    }
  }

  const intentErrors = details.filter(d => !d.intentCorrect);
  if (intentErrors.length > 0) {
    console.log(`  Total kesalahan intent classification: ${intentErrors.length}/${details.length}\n`);
    for (const e of intentErrors) {
      console.log(`  Query   : "${e.query}"`);
      console.log(`  Expected: ${e.expectedIntent}  →  Got: ${e.predictedIntent}`);
      console.log('');
    }
  }

  console.log('='.repeat(70));
  console.log('  EVALUASI SELESAI');
  console.log('='.repeat(70));
}

main().catch(err => { console.error(err); process.exit(1); });
