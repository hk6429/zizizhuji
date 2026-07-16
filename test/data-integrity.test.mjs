import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateZiyinEntry, validateChengyuEntry } from '../js/schema.js';

const ziyin = JSON.parse(readFileSync(new URL('../data/ziyin-zixing-elementary.json', import.meta.url)));
const chengyu = JSON.parse(readFileSync(new URL('../data/chengyu-elementary.json', import.meta.url)));
const ziyinJunior = JSON.parse(readFileSync(new URL('../data/ziyin-zixing-junior.json', import.meta.url)));
const chengyuJunior = JSON.parse(readFileSync(new URL('../data/chengyu-junior.json', import.meta.url)));
const ziyinAnchor = JSON.parse(readFileSync(new URL('../tools/anchors/ziyin-anchor.json', import.meta.url)));
const chengyuAnchor = JSON.parse(readFileSync(new URL('../tools/anchors/chengyu-anchor.json', import.meta.url)));
const chengyuAnchorSet = new Set(chengyuAnchor.idioms);
const ZIYIN_FORMATS = new Set(['reading', 'reading-alt', 'reading-odd', 'reading-live']);
const ZIXING_FORMATS = new Set(['zixing-blank', 'zixing-pick-wrong', 'zixing-sentence', 'zixing-story', 'zixing-fix']);
const CHENGYU_FORMATS = new Set(['def-pick', 'idiom-def', 'usage-judge', 'usage-wrong', 'fill-blank', 'synonym', 'antonym', 'story-blank', 'error-char']);

function hanChars(text) {
  return [...String(text)].filter((char) => /\p{Script=Han}/u.test(char));
}

function legacyReadingTarget(entry) {
  return entry.question.match(/「[^」]+」的「([^」]+)」正確讀音是？/)?.[1];
}

function entryTarget(entry) {
  return entry.anchor?.[0] ?? legacyReadingTarget(entry) ?? entry.answer;
}

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
  const selfMade = [...ziyin, ...ziyinJunior].filter((e) => e.origin === '自編' && e.type === '字音');
  assert.ok(selfMade.length > 0, 'expected at least one 自編 entry to exist');
  for (const e of selfMade) {
    const qformat = e.qformat ?? 'reading';
    assert.ok(ZIYIN_FORMATS.has(qformat), `unknown 字音 qformat: ${e.id} / ${qformat}`);
    if (qformat === 'reading') {
      assert.ok(legacyReadingTarget(e), `question format unexpected: ${e.id}`);
    }
    assert.ok(Array.isArray(e.anchor) || qformat === 'reading', `new 字音 format must provide anchor: ${e.id}`);
    const chars = e.anchor ?? [legacyReadingTarget(e)];
    for (const char of chars) assert.ok(ziyinAnchor[char], `char not in anchor: ${e.id} / ${char}`);
    if (qformat !== 'reading-odd') {
      const char = chars[0];
      assert.ok(ziyinAnchor[char].zhuyin.includes(e.answer), `answer not a real reading: ${e.id} / ${char} / ${e.answer}`);
    } else {
      assert.equal(chars.length, 4, `reading-odd requires four anchored chars: ${e.id}`);
      assert.match(e.note ?? '', /讀音佐證：/, `reading-odd note must list readings: ${e.id}`);
    }
    if (qformat === 'reading-alt') {
      assert.ok(ziyinAnchor[chars[0]].zhuyin.length >= 2, `reading-alt target is not polyphonic: ${e.id}`);
      assert.match(e.note ?? '', /萌典佐證詞：\S+/, `reading-alt note needs a Moedict evidence word: ${e.id}`);
    }
  }
});

test('自編 字形 entries: all options are real characters and answer is among them', () => {
  const selfMade = [...ziyin, ...ziyinJunior].filter((e) => e.origin === '自編' && e.type === '字形');
  assert.ok(selfMade.length > 0, 'expected at least one 自編 字形 entry to exist');
  for (const e of selfMade) {
    const qformat = e.qformat ?? 'zixing-blank';
    assert.ok(ZIXING_FORMATS.has(qformat), `unknown 字形 qformat: ${e.id} / ${qformat}`);
    assert.ok(e.options.includes(e.answer), `answer not among options: ${e.id}`);
    if (e.qformat) {
      assert.equal(e.anchor?.length, 1, `new 字形 format requires one target anchor: ${e.id}`);
      assert.ok(ziyinAnchor[e.anchor[0]], `target not in anchor: ${e.id} / ${e.anchor[0]}`);
      assert.match(e.note ?? '', /【T(?:10|[1-9])】$/, `new entry note must end with persona id: ${e.id}`);
    }
    for (const opt of e.options) {
      for (const char of hanChars(opt)) assert.ok(ziyinAnchor[char], `option contains a non-anchor character: ${e.id} / ${char}`);
    }
  }
});

test('ziyin-zixing-junior answers only use chars not already actually tested at 國小 level', () => {
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
    const targetChar = entryTarget(e);
    assert.ok(targetChar, `could not extract target char: ${e.id}`);
    assert.ok(!elemUsed.has(targetChar), `char already actually tested at 國小 level, should not reappear at 國中: ${e.id} / ${targetChar}`);
    assert.ok(ziyinAnchor[targetChar], `char not a real CNS11643 character: ${e.id} / ${targetChar}`);
  }
});

test('chengyu-junior entries: qformat anchors are real 教育部/moedict headwords', () => {
  const elemUsed = new Set(chengyu.flatMap((e) => [e.answer, ...e.options]));
  for (const e of chengyuJunior) {
    const qformat = e.qformat ?? 'def-pick';
    assert.ok(CHENGYU_FORMATS.has(qformat), `unknown 成語 qformat: ${e.id} / ${qformat}`);
    const anchors = e.anchor ?? [e.answer];
    for (const idiom of anchors) {
      assert.ok(chengyuAnchorSet.has(idiom), `anchor not a real 成語 headword: ${e.id} / ${idiom}`);
    }
    if (['def-pick', 'fill-blank', 'story-blank', 'synonym', 'antonym', 'error-char'].includes(qformat)) {
      assert.ok(chengyuAnchorSet.has(e.answer), `answer not a real 成語 headword: ${e.id} / ${e.answer}`);
      assert.ok(!elemUsed.has(e.answer), `idiom already used at 國小 level: ${e.id} / ${e.answer}`);
    }
    if (['usage-judge', 'usage-wrong'].includes(qformat)) {
      assert.equal(anchors.length, 4, `usage format requires four anchored idioms: ${e.id}`);
    }
    if (['synonym', 'antonym'].includes(qformat)) {
      assert.ok(anchors.length >= 2, `semantic relation format requires prompt and answer anchors: ${e.id}`);
      assert.match(e.note ?? '', /語義依據：/, `semantic relation note is required: ${e.id}`);
    }
    if (qformat === 'error-char') {
      for (const opt of e.options) {
        if (opt !== e.answer) assert.ok(!chengyuAnchorSet.has(opt), `wrong spelling is another real idiom: ${e.id} / ${opt}`);
        for (const char of hanChars(opt)) assert.ok(ziyinAnchor[char], `error-char option contains a non-anchor character: ${e.id} / ${char}`);
      }
    }
    if (e.qformat) assert.match(e.note ?? '', /【T(?:10|[1-9])】$/, `new entry note must end with persona id: ${e.id}`);
  }
});

test('every explicit anchor resolves against the corresponding official anchor file', () => {
  for (const e of ziyinJunior) {
    for (const char of e.anchor ?? []) assert.ok(ziyinAnchor[char], `${e.id}: unknown character anchor ${char}`);
  }
  for (const e of chengyuJunior) {
    for (const idiom of e.anchor ?? []) assert.ok(chengyuAnchorSet.has(idiom), `${e.id}: unknown idiom anchor ${idiom}`);
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
