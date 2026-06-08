/**
 * generate_responses.js
 * Generate NLG responses for evaluation test cases by calling the rule engine directly.
 * This bypasses HTTP authentication.
 *
 * Usage:  node generate_responses.js
 * Output: results/generated_responses.json
 */

const path = require('path');
const fs   = require('fs');

// Resolve paths
const EVAL_DIR    = __dirname;
const RESULTS_DIR = path.join(EVAL_DIR, 'results');
const TEST_CASES  = path.join(EVAL_DIR, 'test_cases.json');

// Ensure results dir exists
if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR);

async function main() {
  // Load rule engine (will also init DB pool)
  const ruleEngine = require('../src/rules/engine/ruleEngine');

  // Load test cases
  const testCases = JSON.parse(fs.readFileSync(TEST_CASES, 'utf-8'));
  console.log(`📋 Total test cases: ${testCases.length}\n`);

  const output = [];

  for (const tc of testCases) {
    process.stdout.write(`  [${tc.id}] ${tc.query.slice(0, 55)}... `);
    try {
      const result = await ruleEngine.processQuery(tc.query, { userId: 'eval', geoContext: null });
      const generated = result.success ? result.response : '';
      console.log(result.success ? `✅ rule=${result.rule_id}` : '⚠️  no match');
      output.push({ ...tc, generated, rule_matched: result.rule_id || null });
    } catch (err) {
      console.log(`❌ ${err.message}`);
      output.push({ ...tc, generated: '', rule_matched: null, error: err.message });
    }
  }

  const outPath = path.join(RESULTS_DIR, 'generated_responses.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n💾 Saved to ${outPath}`);

  // Exit cleanly (Oracle pool keeps process alive)
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
