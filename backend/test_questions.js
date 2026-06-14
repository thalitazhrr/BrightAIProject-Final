const fs = require('fs');
const path = require('path');

const guidedQuestions = {
  sales: [
    'Berapa total order HSI bisnis dan basic bulan ini?',
    'Bagaimana distribusi order HSI per regional dan witel?',
    'Analisis order HSI berdasarkan kategori bandwidth',
    'Tingkat penetrasi HSI di wilayah mana paling tinggi?',
    'Bagaimana coverage dan performa STO untuk layanan HSI?',
    'Bagaimana tingkat keberhasilan fulfillment order HSI?',
    'Analisis waktu instalasi HSI per wilayah',
    'Analisis revenue HSI berdasarkan kategori bandwidth',
    'Performa channel penjualan HSI yang paling efektif',
    'Bagaimana penetrasi produk digital bersama layanan HSI?',
    'Bagaimana pola musiman order HSI sepanjang tahun?',
    'Tren pertumbuhan order HSI bulanan dan tahunan',
  ],
  dapros: [
    'Segmentasi pelanggan HSI berdasarkan speed dan revenue',
    'Analisis bundle layanan HSI dan produk tambahan',
    'Profil digital dan transformasi teknologi pelanggan HSI',
    'Profil revenue pelanggan HSI per segmen',
    'Distribusi geografis pelanggan HSI per wilayah',
    'Distribusi kecepatan layanan HSI per customer',
    'Analisis loyalitas pelanggan HSI dan tenure layanan',
  ],
  target: [
    'Performa pencapaian target hsi dan realisasi',
    'Analisis segmen hsi dan target per segmen',
    'Performa target regional hsi',
    'Pola pertumbuhan dan trend target hsi',
    'Analisis benchmark hsi dan kompetitif target',
  ],
  revenue: [
    'Tren revenue hsi bulanan dan pertumbuhannya',
    'Performa regional hsi dan revenue internet',
    'Analisis lifecycle pelanggan hsi dan retensi',
    'Strategi scaling revenue hsi dan new recurring',
    'Klasifikasi gl account hsi',
    'Portofolio dan hierarki layanan hsi',
    'Analisis behavior pelanggan hsi',
    'Analisis cross geographic hsi multi lokasi',
  ],
  churn: [
    'Analisis tingkat churn rate regional',
    'Pola ct0 berdasarkan masa layanan',
    'Pola bandwidth churn dan cabut layanan',
    'Performa witel churn dan analisisnya',
    'Pola bulanan dan kuartalan monthly churn',
    'Perbandingan divisi churn antar layanan',
  ]
};

const rulesDir = path.join(__dirname, 'src', 'rules', 'databases');
let allRules = [];

function loadRulesFromDir(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      loadRulesFromDir(fullPath);
    } else if (fullPath.endsWith('.js')) {
      try {
        const rule = require(fullPath);
        if (rule && rule.KEYWORD_PATTERNS && rule.KEYWORD_PATTERNS.calculateConfidence) {
          allRules.push({
            id: rule.RULE_META.RULE_ID,
            db: rule.RULE_META.DATABASE,
            name: rule.RULE_META.RULE_NAME,
            calc: rule.KEYWORD_PATTERNS.calculateConfidence.bind(rule.KEYWORD_PATTERNS)
          });
        }
      } catch(e) {}
    }
  }
}

loadRulesFromDir(rulesDir);

let issues = [];

for (const [domain, questions] of Object.entries(guidedQuestions)) {
  for (const q of questions) {
    let bestScore = -1;
    let bestRule = null;
    let scores = [];
    for (const rule of allRules) {
      const score = rule.calc(q);
      scores.push({id: rule.id, db: rule.db, name: rule.name, score});
      if (score > bestScore) {
        bestScore = score;
        bestRule = rule;
      }
    }
    scores.sort((a,b) => b.score - a.score);
    
    let expectedDb = '';
    if (domain === 'sales') expectedDb = 'BRIGHTAI_SALES';
    if (domain === 'dapros') expectedDb = 'BRIGHTAI_DAPROS';
    if (domain === 'target') expectedDb = 'BRIGHTAI_TARGET';
    if (domain === 'revenue') expectedDb = 'BRIGHTAI_REVENUE';
    if (domain === 'churn') expectedDb = 'BRIGHTAI_CT0_NAL';

    if (bestRule && bestRule.db !== expectedDb && bestScore >= 65) {
      // It matches WRONG database
      issues.push(`Mismatch! Q: "${q}"\n  Expected: ${domain} (${expectedDb})\n  Got: ${bestRule.db} via ${bestRule.name} (Score: ${bestScore})`);
      const expectedScores = scores.filter(s => s.db === expectedDb && s.score > 0);
      if (expectedScores.length > 0) {
        issues.push(`  Best expected rule was: ${expectedScores[0].name} (Score: ${expectedScores[0].score})`);
      }
    } else if (bestRule && bestScore < 65) {
      // Nothing matches well
      issues.push(`Low Confidence! Q: "${q}" (Domain: ${domain}, Best Rule: ${bestRule.name}, Score: ${bestScore})`);
    } else {
       // Matches correct database, but check for ties/collisions
       const collisions = scores.filter(s => s.db !== expectedDb && s.score >= bestScore);
       if (collisions.length > 0) {
           issues.push(`Collision Risk! Q: "${q}"\n  Matched expected ${bestRule.name} (Score: ${bestScore}), but tied/beaten by: ${collisions.map(c => c.name + ' (' + c.score + ')').join(', ')}`);
       }
    }
  }
}

console.log(JSON.stringify(issues, null, 2));
