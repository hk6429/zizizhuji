import { readFileSync } from 'node:fs';
import { validateChengyuEntry } from '../js/schema.js';

const bank = JSON.parse(readFileSync(new URL('../data/chengyu-elementary.json', import.meta.url)));

let failCount = 0;
for (const entry of bank) {
  const { valid, errors } = validateChengyuEntry(entry);
  if (!valid) {
    failCount++;
    console.error(`[FAIL] ${entry.id}: ${errors.join(', ')}`);
  }
}

const bySource = {};
const byType = {};
for (const entry of bank) {
  bySource[entry.source] = (bySource[entry.source] || 0) + 1;
  byType[entry.type] = (byType[entry.type] || 0) + 1;
}
console.log('題數統計（依來源）:', bySource);
console.log('題數統計（依題型）:', byType);
console.log(`總題數: ${bank.length}, 驗證失敗: ${failCount}`);
process.exit(failCount > 0 ? 1 : 0);
