const fs = require('fs');
const path = './backend/src/rules/engine/nlgGenerator.js';

let content = fs.readFileSync(path, 'utf8');

// Add helper function at the top after SKIP_COLS
const helperFunc = `
function formatItem(item, defaultLabel) {
  if (typeof item === 'string') {
    // Jika sudah ada bold, jangan diubah
    if (item.includes('**')) return \`- \${item}\`;
    
    // Ambil 2-3 kata pertama untuk dijadikan label (maksimal 3 kata)
    const words = item.split(' ');
    if (words.length <= 4) {
      return \`- **\${item}**\`;
    }
    
    // Bikin Capitalized label
    const labelWords = words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    const label = labelWords.join(' ');
    
    // Return format bold label tanpa mengulang kata di isinya
    // Tapi lebih aman kita kasih format: **Label**: text
    // Namun untuk menghindari pengulangan, kita bold saja beberapa kata pertama di kalimatnya
    const boldPart = words.slice(0, 2).join(' ');
    const restPart = words.slice(2).join(' ');
    return \`- **\${boldPart}** \${restPart}\`;
  }
  
  if (defaultLabel === 'Insight') {
    return \`- **\${item.kategori || item.area || defaultLabel}**: \${item.nilai || item.insight || item.rekomendasi || item.deskripsi || '-'}\`;
  } else {
    return \`- **\${item.area || item.kategori || defaultLabel}**: \${item.rekomendasi || item.nilai || item.insight || item.deskripsi || '-'}\`;
  }
}
`;

content = content.replace(/(const SKIP_COLS = new Set\(\['tahun','bulan','tahun_str','bulan_str'\]\);[\s\S]*?function arrayToTable[\s\S]*?\}\n)/, '$1' + helperFunc);

// Replace all insights maps
content = content.replace(/insights\.map\(w => typeof w === 'string' \? `- \$\{w\}` : `- \*\*.*\)\.join\('\\n'\)/g, "insights.map(w => formatItem(w, 'Insight')).join('\\n')");

// Replace all reko maps
content = content.replace(/reko\.map\(r => typeof r === 'string' \? `- \$\{r\}` : `- \*\*.*\)\.join\('\\n'\)/g, "reko.map(r => formatItem(r, 'Rekomendasi')).join('\\n')");

// Replace polaInsights maps
content = content.replace(/polaInsights\.map\(w => typeof w === 'string' \? `- \$\{w\}` : `- \*\*.*\)\.join\('\\n'\)/g, "polaInsights.map(w => formatItem(w, 'Insight')).join('\\n')");

fs.writeFileSync(path, content, 'utf8');
console.log("nlgGenerator updated!");
