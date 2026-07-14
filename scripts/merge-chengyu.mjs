import { readFileSync, writeFileSync } from 'node:fs';
import { validateChengyuEntry } from '../js/schema.js';

// Merges Task 8's two research streams:
// - 真題錨點: real chengyu-testing questions pulled from ~/projects/cap-guowen
//   (國中基測/會考), raw output in scripts/raw/chengyu-real-anchors.json
// - 自編補足: idioms authored per 教育部《成語典》 to reach elementary-level
//   scale, raw output in scripts/raw/chengyu-authored-0{1,2,3}.json
// See scripts/chengyu-fetch-notes.md for full sourcing method and caveats.

const real = JSON.parse(readFileSync('scripts/raw/chengyu-real-anchors.json', 'utf8'));
const authored = [1, 2, 3].flatMap((n) =>
  JSON.parse(readFileSync(`scripts/raw/chengyu-authored-0${n}.json`, 'utf8'))
);

// The real-anchor research agent recorded each citation string directly in
// `source` (e.g. "90年國中基測國文第6題"). Schema requires source to be the
// enum "真題"|"自編"; the citation moves to `note` so provenance is preserved.
const realNormalized = real.map((e) => ({ ...e, note: e.source, source: '真題' }));

const combined = [...realNormalized, ...authored].map((e) => ({ level: '國小', ...e }));

let fail = 0;
const seenIds = new Set();
for (const e of combined) {
  const { valid, errors } = validateChengyuEntry(e);
  if (!valid) {
    fail++;
    console.error(`[FAIL] ${e.id}: ${errors.join(', ')}`);
  }
  if (seenIds.has(e.id)) {
    fail++;
    console.error(`[DUP ID] ${e.id}`);
  }
  seenIds.add(e.id);
}

const bySource = {};
const byType = {};
for (const e of combined) {
  bySource[e.source] = (bySource[e.source] || 0) + 1;
  byType[e.type] = (byType[e.type] || 0) + 1;
}
console.log('依來源統計:', bySource);
console.log('依題型統計:', byType);
console.log(`合併後總題數: ${combined.length}, 驗證失敗: ${fail}`);

if (fail === 0) {
  writeFileSync('data/chengyu-elementary.json', JSON.stringify(combined, null, 2) + '\n');
  console.log('已寫入 data/chengyu-elementary.json');
} else {
  console.error('驗證失敗，未寫入。');
  process.exit(1);
}
