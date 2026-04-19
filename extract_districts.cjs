const fs = require('fs');
const text = fs.readFileSync('c:/Users/Spud/PFBC/POINT FORTIN.csv', 'utf8');
const lines = text.split('\n');

function parseLine(line) {
  const cols = [];
  let cur = '';
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

// col 5 = ADDRESS, col 6 = POLLING DIVISION, col 8 = MUNICIPAL ELECTORAL DISTRICT, col 10 = CORPORATION
const dists = new Map();
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const cols = parseLine(lines[i]);
  const dist = (cols[8] || '').trim().replace(/\r$/, '');
  const pd = (cols[6] || '').trim();
  const corp = (cols[10] || '').trim();
  const address = (cols[5] || '').trim().replace(/\r$/, '');

  if (!dist || dist.length < 2) continue;
  if (!dists.has(dist)) {
    dists.set(dist, { pd, corp, streets: new Set() });
  }
  if (address && address.length > 2) {
    // Clean lot number prefix from address: LP62, 332, 30, etc.
    const cleaned = address.replace(/^(LP\d+|L\.P\.\d+|\d+[A-Z]?)\s*/i, '').replace(/^[,\s]+/, '').trim();
    if (cleaned && cleaned.length > 2 && cleaned.length < 80) {
      dists.get(dist).streets.add(cleaned);
    }
  }
}

console.log('export const POINT_FORTIN_DISTRICTS = [');
dists.forEach((val, name) => {
  const streets = [...val.streets].sort();
  console.log(`  {`);
  console.log(`    districtName: ${JSON.stringify(name)},`);
  console.log(`    pollingDivision: ${JSON.stringify(val.pd)},`);
  console.log(`    corporation: ${JSON.stringify(val.corp)},`);
  console.log(`    streets: ${JSON.stringify(streets)},`);
  console.log(`  },`);
});
console.log('];');
