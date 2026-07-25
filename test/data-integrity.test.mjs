import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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

test('new-format questions are unique within each junior bank (stem+options)', () => {
  // 通用題幹（如「哪一個用字不正確？」）允許重複，選項才是題目本體；
  // 題幹＋選項完全相同才視為重複題。
  for (const [name, entries] of Object.entries({ ziyinJunior, chengyuJunior })) {
    const keys = entries
      .filter((e) => e.qformat && e.qformat !== 'def-pick')
      .map((e) => `${e.question}|${e.options.join('|')}`);
    assert.equal(new Set(keys).size, keys.length, `${name}: repeated new-format question (stem+options)`);
  }
});

test('new-format stories and direct idiom choices satisfy their content contracts', () => {
  for (const e of ziyinJunior.filter((entry) => entry.qformat === 'zixing-story')) {
    assert.ok(e.question.length >= 40 && e.question.length <= 80, `${e.id}: zixing-story must be 40-80 characters`);
  }
  for (const e of chengyuJunior.filter((entry) => ['fill-blank', 'story-blank', 'synonym', 'antonym'].includes(entry.qformat))) {
    for (const option of e.options) assert.ok(chengyuAnchorSet.has(option), `${e.id}: direct idiom option is not anchored: ${option}`);
  }
  for (const e of [...ziyinJunior, ...chengyuJunior].filter((entry) => entry.qformat && entry.qformat !== 'def-pick')) {
    assert.match(e.note ?? '', /【T(?:10|[1-9])】$/, `${e.id}: persona marker missing`);
  }
});

test('usage questions use natural contextual sentences instead of definition matching', () => {
  const usageEntries = chengyuJunior.filter((entry) => ['usage-judge', 'usage-wrong'].includes(entry.qformat));
  const forbidden = /可用來(?:表示|概括|表達)|釋義|引號中的意思|形容|比喻|用來|泛指|借指|代指|語出|典故|生活態度|象徵|呈現|比擬|…/;
  const limitedPhrases = ['家人聽說', '校刊記下', '老師看到', '同學讀到', '不禁感嘆', '忍不住說', '編輯直呼', '這正是'];
  const allOptions = usageEntries.flatMap((entry) => entry.options);
  assert.equal(usageEntries.length, 538, 'usage bank size changed unexpectedly');
  for (const phrase of limitedPhrases) {
    const count = allOptions.filter((option) => option.includes(phrase)).length;
    assert.ok(count <= 10, `usage formula exceeds limit: ${phrase} / ${count}`);
  }
  for (const e of usageEntries) {
    assert.match(e.question, /^下列成語的運用，何者(?:使用正確|使用不恰當)？$/, `${e.id}: usage stem is not concise`);
    for (const option of e.options) {
      assert.ok(option.length >= 18 && option.length <= 45, `${e.id}: usage option must be 18-45 characters / ${option}`);
      assert.doesNotMatch(option, forbidden, `${e.id}: usage option still contains definition-matching prose`);
      assert.ok(e.anchor.some((idiom) => option.includes(idiom)), `${e.id}: option has no anchored idiom / ${option}`);
    }
    assert.equal(new Set(e.options.map((option) => option.slice(0, 4))).size, 4, `${e.id}: four options repeat the same scene opening`);
    const used = new Set(e.options.flatMap((option) => e.anchor.filter((idiom) => option.includes(idiom))));
    assert.deepEqual(used, new Set(e.anchor), `${e.id}: anchor must list every idiom used by the options`);
    assert.match(e.note, /誤用：/, `${e.id}: note must explain the misuse`);
  }
});

test('round-three usage rewrite preserves id, anchor, qformat, and question exactly', () => {
  const immutableProjection = chengyuJunior
    .filter((entry) => ['usage-judge', 'usage-wrong'].includes(entry.qformat))
    .map(({ id, anchor, qformat, question }) => ({ id, anchor, qformat, question }));
  const digest = createHash('sha256').update(JSON.stringify(immutableProjection)).digest('hex');
  assert.equal(digest, '5be71538e84f34ff623ee460d7880295eda97953ae8a841e9dea4b964469d6da');
});

test('fill and story blanks do not contain the round-two meta-writing templates', () => {
  for (const e of chengyuJunior.filter((entry) => ['fill-blank', 'story-blank'].includes(entry.qformat))) {
    assert.doesNotMatch(e.question, /資料先交代|濃縮成一句旁白/, `${e.id}: meta-writing template remains`);
  }
});

test('audited zixing ambiguities are resolved by context or unambiguous distractors', () => {
  const replaced = {
    'zy-中-1715': ['糖類'], 'zy-中-1758': ['隕落'], 'zy-中-1776': ['迴游', '回游'],
    'zy-中-1785': ['凹地'], 'zy-中-1825': ['混濁'], 'zy-中-1945': ['樹幹'],
    'zy-中-2002': ['挨過'], 'zy-中-2032': ['摂取', '攝取'], 'zy-中-2298': ['桐林'],
    'zy-中-2308': ['桔子'], 'zy-中-2507': ['顛峰'], 'zy-中-2575': ['精英'],
    'zy-中-2614': ['二心'], 'zy-中-2660': ['糟蹋'], 'zy-中-2746': ['刮風'],
    'zy-中-2760': ['糊口'], 'zy-中-2821': ['金雕'], 'zy-中-2903': ['璀燦'],
    'zy-中-2974': ['艋甲'], 'zy-中-3054': ['嘩然'],
  };
  for (const [id, oldForms] of Object.entries(replaced)) {
    const entry = ziyinJunior.find((item) => item.id === id);
    const serialized = JSON.stringify(entry);
    for (const oldForm of oldForms) assert.ok(!serialized.includes(oldForm), `${id}: ambiguous old form remains / ${oldForm}`);
  }
  const contextualized = [
    'zy-中-1637', 'zy-中-1670', 'zy-中-1675', 'zy-中-1779', 'zy-中-1857',
    'zy-中-2042', 'zy-中-2075', 'zy-中-2093', 'zy-中-2099', 'zy-中-2101',
    'zy-中-2114', 'zy-中-2236', 'zy-中-2289', 'zy-中-2379', 'zy-中-2490',
    'zy-中-2492', 'zy-中-2657', 'zy-中-2670', 'zy-中-2706', 'zy-中-2775',
    'zy-中-2857', 'zy-中-2970', 'zy-中-2979', 'zy-中-3022',
  ];
  for (const id of contextualized) {
    const entry = ziyinJunior.find((item) => item.id === id);
    assert.match(entry.question, /（.+）$/, `${id}: disambiguating context is missing`);
  }
  assert.match(ziyinJunior.find((item) => item.id === 'zy-中-3003').question, /冰塊.*固態冰變成液態/, 'zy-中-3003: melt context is missing');
});

test('reported zixing item zy-中-2934 uses an unambiguous typo without leaking the answer', () => {
  const entry = ziyinJunior.find((item) => item.id === 'zy-中-2934');
  assert.equal(entry.anchor?.[0], '睏');
  assert.equal(entry.answer, '捆');
  assert.ok(entry.options.includes('捆'));
  assert.match(entry.question, /捆倦/);
  assert.doesNotMatch(entry.question, /誤寫成|應改為/);
  assert.doesNotMatch(
    `${entry.question}${entry.note}${entry.explain.join('')}`,
    /「困倦」應改為「睏倦」|「困」為錯字/,
  );
});

test('reported item zx-編-0281 gives 星火燎原 the correct pronunciation cue', () => {
  const entry = ziyin.find((item) => item.id === 'zx-編-0281');
  assert.match(entry.question, /星火ㄌㄧㄠˊ原/);
  assert.doesNotMatch(entry.question, /星火ㄌㄧㄠˋ原/);
  assert.equal(entry.answer, '燎');
});

test('reported item zy-中-2167 asks about 錕鋙 without leaking 錕 in the stem', () => {
  const entry = ziyinJunior.find((item) => item.id === 'zy-中-2167');
  assert.match(entry.question, /「○鋙」/);
  assert.doesNotMatch(entry.question, /錕鋙/);
  assert.equal(entry.answer, '錕');
  assert.deepEqual(entry.options, ['昆', '混', '錕', '坤']);
  assert.match(entry.explain[2], /也作.?昆吾/);
});

test('reported item cy-中-2063 has one clear misuse and three supported usages', () => {
  const entry = chengyuJunior.find((item) => item.id === 'cy-中-2063');
  assert.equal(entry.answer, entry.options[0]);
  assert.match(entry.options[0], /重新振作.*槁木死灰/);
  assert.match(entry.options[1], /陳季常.*河東獅子/);
  assert.match(entry.options[2], /新居落成.*竹苞松茂/);
  assert.match(entry.options[3], /得寵或受辱.*寵辱若驚/);
  assert.doesNotMatch(entry.options.join(''), /悍妒善妒|同一口灶/);
  assert.match(entry.note, /槁木死灰誤用：/);
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

// js/app.js 用同一組 regex 判斷 note 是不是純資料出處標註（不該當辨析顯示）；
// 這裡鎖住兩件事：規則本身要能辨識現有的兩種出處格式，且非 def-pick 的成語題要真的帶得出辨析內容
// 給答題頁顯示，避免資料改版後 bindAnswer() 的 note fallback 又悄悄退化成空白。
const CITATION_ONLY_NOTE_RES = [
  /^\d+年國中(基測|會考)國文第\d+題$/,
  /^教育部重編國語辭典＋g0v moedict成語詞頭錨定【T\d+】$/,
];
function isCitationOnlyNote(note) {
  return CITATION_ONLY_NOTE_RES.some((re) => re.test(note));
}

test('chengyu-elementary note 全數是考題出處標註，不會被誤當辨析顯示', () => {
  const bad = chengyu.filter((e) => e.note && !isCitationOnlyNote(e.note));
  assert.deepEqual(bad.map((e) => e.id), []);
});

test('chengyu-junior 除了 def-pick，其餘 qformat 都要帶有可顯示的辨析 note', () => {
  const missing = chengyuJunior.filter((e) => e.qformat !== 'def-pick' && (!e.note || isCitationOnlyNote(e.note)));
  assert.deepEqual(missing.map((e) => e.id), []);
});
