import { readFileSync } from 'node:fs';
import { validateZiyinEntry } from '../js/schema.js';

const bank = JSON.parse(readFileSync(new URL('../data/ziyin-zixing-elementary.json', import.meta.url)));

let failCount = 0;
for (const entry of bank) {
  const { valid, errors } = validateZiyinEntry(entry);
  if (!valid) {
    failCount++;
    console.error(`[FAIL] ${entry.id}: ${errors.join(', ')}`);
  }
}

const byYear = {};
for (const entry of bank) {
  byYear[entry.year] = (byYear[entry.year] || 0) + 1;
}
console.log('題數統計（依年度）:', byYear);
console.log(`總題數: ${bank.length}, 驗證失敗: ${failCount}`);
process.exit(failCount > 0 ? 1 : 0);
