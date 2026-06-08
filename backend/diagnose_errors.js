#!/usr/bin/env node
/**
 * diagnose_errors.js
 * ──────────────────
 * Diagnosa 8 error pada evaluasi intent classification.
 * Menampilkan TOP-5 skor confidence per error query,
 * sehingga terlihat rule mana yang bersaing dan margin skornya.
 *
 * Jalankan:  node diagnose_errors.js
 */

'use strict';

const path = require('path');

// Stub logger
const loggerPath = path.join(__dirname, 'src/utils/logger.js');
require.cache[require.resolve(loggerPath)] = {
  id: loggerPath, filename: loggerPath, loaded: true,
  exports: { info(){}, warn(){}, error(){}, debug(){} }
};

const ruleLoader = require('./src/rules/engine/ruleLoader');

// 8 error queries dari evaluasi terakhir
const ERROR_QUERIES = [
  { query: 'Order HSI per wilayah regional',                    expected: 'ps_002',     got: 'dapros_007' },
  { query: 'Jumlah order per speed internet',                   expected: 'ps_003',     got: 'ps_001' },
  { query: 'Tingkat penetrasi HSI di wilayah witel',            expected: 'ps_004',     got: 'dapros_006' },
  { query: 'Berapa pelanggan HSI yang pakai produk digital pijar', expected: 'ps_010', got: 'dapros_003' },
  { query: 'Revenue trend layanan internet',                    expected: 'mart_001',   got: 'mart_006' },
  { query: 'Performa target HSI per segmentasi pelanggan',      expected: 'target_002', got: 'dapros_004' },
  { query: 'Pencapaian target HSI di setiap regional',          expected: 'target_003', got: 'dapros_007' },
  { query: 'Bandingkan order HSI bisnis dan basic per regional', expected: 'ps_001',    got: 'ps_002' },
];

async function main() {
  const rules = await ruleLoader.loadAllRules();
  const rulesMap = new Map();
  rules.forEach(r => rulesMap.set(r.RULE_META.RULE_ID, r));

  console.log('='.repeat(80));
  console.log('  DIAGNOSA ERROR QUERIES — TOP-5 CONFIDENCE PER QUERY');
  console.log('='.repeat(80));

  for (const { query, expected, got } of ERROR_QUERIES) {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`  Query   : "${query}"`);
    console.log(`  Expected: ${expected}  |  Got: ${got}`);
    console.log(`${'─'.repeat(80)}`);

    // Collect ALL confidence scores
    const scores = [];
    for (const [ruleId, rule] of rulesMap) {
      try {
        if (rule.PATTERN_MATCHING && rule.PATTERN_MATCHING.checkMatch) {
          const result = rule.PATTERN_MATCHING.checkMatch(query);
          if (result.confidence > 0) {
            scores.push({
              ruleId,
              confidence: result.confidence,
              matches: result.matches,
              focus_area: result.focus_area || ''
            });
          }
        }
      } catch (e) { /* skip */ }
    }

    scores.sort((a, b) => b.confidence - a.confidence);

    // Show top 5
    const top = scores.slice(0, 8);
    console.log(`\n  ${'Rank'.padEnd(6)}${'Rule'.padEnd(18)}${'Conf'.padEnd(8)}${'Match'.padEnd(8)}Focus`);
    console.log(`  ${'─'.repeat(70)}`);
    for (let i = 0; i < top.length; i++) {
      const s = top[i];
      const marker = s.ruleId === expected ? ' ← EXPECTED' :
                     s.ruleId === got      ? ' ← WINNER (wrong)' : '';
      console.log(`  ${String(i+1).padEnd(6)}${s.ruleId.padEnd(18)}${String(s.confidence).padEnd(8)}${String(s.matches).padEnd(8)}${s.focus_area}${marker}`);
    }

    // Show expected rule score specifically if not in top
    const expectedScore = scores.find(s => s.ruleId === expected);
    if (expectedScore && !top.find(s => s.ruleId === expected)) {
      console.log(`  ...`);
      const idx = scores.indexOf(expectedScore);
      console.log(`  ${String(idx+1).padEnd(6)}${expectedScore.ruleId.padEnd(18)}${String(expectedScore.confidence).padEnd(8)}${String(expectedScore.matches).padEnd(8)}${expectedScore.focus_area} ← EXPECTED`);
    }

    // Gap analysis
    const winnerConf = scores[0]?.confidence || 0;
    const expectedConf = expectedScore?.confidence || 0;
    console.log(`\n  Gap: winner(${got})=${winnerConf} vs expected(${expected})=${expectedConf} → delta=${winnerConf - expectedConf}`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log('  DIAGNOSA SELESAI');
  console.log('='.repeat(80));
}

main().catch(err => { console.error(err); process.exit(1); });
