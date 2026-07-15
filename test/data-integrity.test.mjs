import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateZiyinEntry, validateChengyuEntry } from '../js/schema.js';

const ziyin = JSON.parse(readFileSync(new URL('../data/ziyin-zixing-elementary.json', import.meta.url)));
const chengyu = JSON.parse(readFileSync(new URL('../data/chengyu-elementary.json', import.meta.url)));

test('every ziyin-zixing entry passes schema validation', () => {
  const bad = ziyin.map((e) => [e.id, validateZiyinEntry(e)]).filter(([, r]) => !r.valid);
  assert.deepEqual(bad, []);
});

test('every chengyu entry passes schema validation', () => {
  const bad = chengyu.map((e) => [e.id, validateChengyuEntry(e)]).filter(([, r]) => !r.valid);
  assert.deepEqual(bad, []);
});

test('ids are unique within each bank', () => {
  assert.equal(new Set(ziyin.map((e) => e.id)).size, ziyin.length);
  assert.equal(new Set(chengyu.map((e) => e.id)).size, chengyu.length);
});

test('自編 字音 entries: answer is a real reading of the character per the CNS11643 anchor', () => {
  const anchor = JSON.parse(readFileSync(new URL('../tools/anchors/ziyin-anchor.json', import.meta.url)));
  const selfMade = ziyin.filter((e) => e.origin === '自編');
  assert.ok(selfMade.length > 0, 'expected at least one 自編 entry to exist');
  for (const e of selfMade) {
    const m = e.question.match(/「[^」]+」的「([^」]+)」正確讀音是？/);
    assert.ok(m, `question format unexpected: ${e.id}`);
    const char = m[1];
    const a = anchor[char];
    assert.ok(a, `char not in anchor: ${e.id} / ${char}`);
    assert.ok(a.zhuyin.includes(e.answer), `answer not a real reading: ${e.id} / ${char} / ${e.answer}`);
  }
});
