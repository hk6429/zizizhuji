import { readFileSync, writeFileSync } from 'node:fs';
import { pickCharDistractors } from '../js/distractor.js';
import { validateZiyinEntry } from '../js/schema.js';

// Merges the 103年 hand-built bank (data/ziyin-zixing-elementary.json, produced by
// build-ziyin.mjs) with additional years visually verified against official answer
// PDFs by research subagents (raw data in scripts/raw/raw-year-*.json).
//
// 105年 字形 entries are a documented special case: 105年's archived paper only
// contained 字音-format questions. The same verified (word, character, reading)
// triples are reformulated here as fill-in-the-character questions; this is
// disclosed both in `source` and `note` on every such entry so no consumer that
// reads only one of the two fields misses the caveat.

const existing = JSON.parse(readFileSync('data/ziyin-zixing-elementary.json', 'utf8'));
const YEARS = [104, 105, 106, 109, 111, 112];
const raw = YEARS.flatMap((y) => JSON.parse(readFileSync(`scripts/raw/raw-year-${y}.json`, 'utf8')));

for (const e of raw) {
  if (e.year === 105 && e.type === '字形') {
    e.source = '105年全國語文競賽國小學生組字音字形試題（官方解答，字形問法為改編自同一批真實字音答案，見note）';
    e.note = '本題依105年官方字音解答之真實詞例／字義／讀音改寫為字形辨正問法；105年考古題原始公開版本僅見字音類試卷，字形類問法非另尋自獨立字形考卷，答案本身仍為官方核實之真實字。';
  }
}

// Fill distractors for entries collected without options yet (same year+type pool of real answers only)
const byYearType = new Map();
for (const e of raw) {
  const key = `${e.year}|${e.type}`;
  if (!byYearType.has(key)) byYearType.set(key, []);
  byYearType.get(key).push(e.answer);
}
for (const e of raw) {
  if (!e.options || e.options.length === 0) {
    const pool = byYearType.get(`${e.year}|${e.type}`);
    const distractors = pickCharDistractors(e.answer, pool, 3);
    e.options = [e.answer, ...distractors].sort(() => Math.random() - 0.5);
  }
}

// Renumber ids per year, prefix reflects type (zy- = 字音, zx- = 字形), matching build-ziyin.mjs convention
const combined = [...existing];
for (const y of YEARS) {
  let seq = 1;
  for (const e of raw.filter((r) => r.year === y)) {
    const prefix = e.type === '字形' ? 'zx' : 'zy';
    e.id = `${prefix}-${y}-${String(seq++).padStart(3, '0')}`;
    combined.push(e);
  }
}

let fail = 0;
const seenIds = new Set();
for (const e of combined) {
  const { valid, errors } = validateZiyinEntry(e);
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

const byYear = {};
for (const e of combined) byYear[e.year] = (byYear[e.year] || 0) + 1;
console.log('依年度統計:', byYear);
console.log(`合併後總題數: ${combined.length}, 驗證失敗: ${fail}`);

if (fail === 0) {
  writeFileSync('data/ziyin-zixing-elementary.json', JSON.stringify(combined, null, 2) + '\n');
  console.log('已寫入 data/ziyin-zixing-elementary.json');
} else {
  console.error('驗證失敗，未寫入。');
  process.exit(1);
}
