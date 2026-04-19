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

const header = parseLine(lines[0]);
console.log('HEADERS:');
header.forEach((h, i) => console.log(`  ${i}: ${h}`));

const row = parseLine(lines[1]);
console.log('\nSAMPLE ROW:');
row.forEach((v, i) => console.log(`  ${i}: ${v}`));

// Get unique districts
const dists = new Map();
for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;
  const cols = parseLine(lines[i]);
  const dist = (cols[8] || '').trim().replace(/\r$/, '');
  const pd = (cols[6] || '').trim();
  const corp = (cols[10] || '').trim();
  if (dist && dist.length > 1 && !dists.has(dist)) {
    dists.set(dist, { pd, corp });
  }
}

console.log('\nUNIQUE MUNICIPAL DISTRICTS:');
dists.forEach((val, name) => console.log(`  "${name}" | PD: ${val.pd} | Corp: ${val.corp}`));
