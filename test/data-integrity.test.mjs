import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateZiyinEntry, validateChengyuEntry } from '../js/schema.js';

const ziyin = JSON.parse(readFileSync(new URL('../data/ziyin-zixing-elementary.json', import.meta.url)));
const chengyu = JSON.parse(readFileSync(new URL('../data/chengyu-elementary.json', import.meta.url)));
const ziyinJunior = JSON.parse(readFileSync(new URL('../data/ziyin-zixing-junior.json', import.meta.url)));
const chengyuJunior = JSON.parse(readFileSync(new URL('../data/chengyu-junior.json', import.meta.url)));

test('every ziyin-zixing entry passes schema validation', () => {
  const bad = [...ziyin, ...ziyinJunior].map((e) => [e.id, validateZiyinEntry(e)]).filter(([, r]) => !r.valid);
  assert.deepEqual(bad, []);
});

test('every chengyu entry passes schema validation', () => {
  const bad = [...chengyu, ...chengyuJunior].map((e) => [e.id, validateChengyuEntry(e)]).filter(([, r]) => !r.valid);
  assert.deepEqual(bad, []);
});

test('ids are unique within each bank', () => {
  assert.equal(new Set(ziyin.map((e) => e.id)).size, ziyin.length);
  assert.equal(new Set(chengyu.map((e) => e.id)).size, chengyu.length);
  assert.equal(new Set(ziyinJunior.map((e) => e.id)).size, ziyinJunior.length);
  assert.equal(new Set(chengyuJunior.map((e) => e.id)).size, chengyuJunior.length);
});

test('every ziyin-zixing-junior entry has level 國中', () => {
  for (const e of ziyinJunior) assert.equal(e.level, '國中', e.id);
});

test('every chengyu-junior entry has level 國中', () => {
  for (const e of chengyuJunior) assert.equal(e.level, '國中', e.id);
});

test('自編 字音 entries: answer is a real reading of the character per the CNS11643 anchor', () => {
  const anchor = JSON.parse(readFileSync(new URL('../tools/anchors/ziyin-anchor.json', import.meta.url)));
  const selfMade = [...ziyin, ...ziyinJunior].filter((e) => e.origin === '自編' && e.type === '字音');
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

test('自編 字形 entries: all options are real characters and answer is among them', () => {
  const anchor = JSON.parse(readFileSync(new URL('../tools/anchors/ziyin-anchor.json', import.meta.url)));
  const selfMade = [...ziyin, ...ziyinJunior].filter((e) => e.origin === '自編' && e.type === '字形');
  assert.ok(selfMade.length > 0, 'expected at least one 自編 字形 entry to exist');
  for (const e of selfMade) {
    assert.ok(e.options.includes(e.answer), `answer not among options: ${e.id}`);
    for (const opt of e.options) {
      assert.ok(anchor[opt], `option not a real character: ${e.id} / ${opt}`);
    }
  }
});

test('ziyin-zixing-junior answers only use chars not already actually tested at 國小 level', () => {
  const fullAnchor = JSON.parse(readFileSync(new URL('../tools/anchors/ziyin-anchor.json', import.meta.url)));
  const elemUsed = new Set();
  for (const e of ziyin) {
    if (e.type === '字音') {
      const m = e.question.match(/「[^」]+」的「([^」]+)」正確讀音是？/);
      if (m) elemUsed.add(m[1]);
    } else {
      elemUsed.add(e.answer);
      for (const o of e.options) elemUsed.add(o);
    }
  }
  for (const e of ziyinJunior) {
    const targetChar = e.type === '字音'
      ? e.question.match(/「[^」]+」的「([^」]+)」正確讀音是？/)?.[1]
      : e.answer;
    assert.ok(targetChar, `could not extract target char: ${e.id}`);
    assert.ok(!elemUsed.has(targetChar), `char already actually tested at 國小 level, should not reappear at 國中: ${e.id} / ${targetChar}`);
    assert.ok(fullAnchor[targetChar], `char not a real CNS11643 character: ${e.id} / ${targetChar}`);
  }
});

test('chengyu-junior entries: answer idiom is a real 教育部/moedict headword not already used at 國小 level', () => {
  const anchor = JSON.parse(readFileSync(new URL('../tools/anchors/chengyu-anchor.json', import.meta.url)));
  const anchorSet = new Set(anchor.idioms);
  const elemUsed = new Set(chengyu.flatMap((e) => [e.answer, ...e.options]));
  for (const e of chengyuJunior) {
    assert.ok(anchorSet.has(e.answer), `answer not a real 成語 headword in anchor: ${e.id} / ${e.answer}`);
    assert.ok(!elemUsed.has(e.answer), `idiom already used at 國小 level: ${e.id} / ${e.answer}`);
  }
});

test('answer position within options is not skewed toward any single slot', () => {
  const banks = { ziyin, chengyu, ziyinJunior, chengyuJunior };
  for (const [name, entries] of Object.entries(banks)) {
    const posCount = [0, 0, 0, 0];
    for (const e of entries) posCount[e.options.indexOf(e.answer)] += 1;
    const total = entries.length;
    for (const [pos, count] of posCount.entries()) {
      const ratio = count / total;
      assert.ok(ratio <= 0.4, `${name}: answer sits in options[${pos}] ${(ratio * 100).toFixed(1)}% of the time (>40%), options may not be shuffled at generation time`);
    }
  }
});
