import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateZiyinEntry, validateChengyuEntry } from '../js/schema.js';

test('validateZiyinEntry accepts a well-formed 字音 entry', () => {
  const entry = {
    id: 'zy-113-001', level: '國小', year: 113,
    source: '113年全國語文競賽國小組第1題',
    type: '字音', question: '「洗滌」的「滌」正確讀音是？',
    options: ['ㄉㄧˊ', 'ㄊㄧˊ', 'ㄉㄧˋ', 'ㄊㄧˋ'],
    answer: 'ㄉㄧˊ', note: ''
  };
  const result = validateZiyinEntry(entry);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateZiyinEntry rejects entry missing answer or wrong option count', () => {
  const missingAnswer = {
    id: 'zy-113-002', level: '國小', year: 113,
    source: '113年全國語文競賽國小組第2題',
    type: '字形', question: '正確寫法是？',
    options: ['潦草', '寮草', '燎草'], answer: '', note: ''
  };
  const result = validateZiyinEntry(missingAnswer);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('options must have exactly 4 entries'));
  assert.ok(result.errors.includes('answer must be non-empty and included in options'));
});

test('schema rejects null, empty, or repeated option strings', () => {
  const entry = {
    id: 'zy-中-options', level: '國中', origin: '自編', source: '自編', type: '字形',
    question: '應選哪個字？', options: ['佞', null, '', '佞'], answer: '佞',
    qformat: 'zixing-fix', anchor: ['佞'],
  };
  const result = validateZiyinEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('options must be four distinct non-empty strings'));
});

test('validateChengyuEntry requires source to be 真題 or 自編', () => {
  const entry = {
    id: 'cy-001', level: '國小', type: '意義',
    source: '網路查的', question: '「一鳴驚人」的意思是？',
    options: ['一開口就震驚眾人', '從不開口', '沉默寡言', '一直哭鬧'],
    answer: '一開口就震驚眾人'
  };
  const result = validateChengyuEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(result.errors.includes('source must be "真題" or "自編"'));
});

test('validateZiyinEntry accepts 國中／選手 level', () => {
  for (const level of ['國中', '選手']) {
    const entry = {
      id: `zy-jh-${level}`, level, origin: '自編',
      source: '教育部常用字表・自編', type: '字音',
      question: '「參差」的「差」正確讀音是？',
      options: ['ㄔㄚ', 'ㄘ', 'ㄔㄞ', 'ㄔㄚˋ'], answer: 'ㄘ', note: ''
    };
    const result = validateZiyinEntry(entry);
    assert.equal(result.valid, true, `${level} should be valid: ${result.errors}`);
  }
});

test('validateZiyinEntry: 自編 exempt from year, 真題 still requires it', () => {
  const selfMade = {
    id: 'zy-e-001', level: '選手', origin: '自編',
    source: '教育部次常用字表・自編', type: '字形',
    question: '下列何者用字完全正確？',
    options: ['甲', '乙', '丙', '丁'], answer: '甲'
  };
  assert.equal(validateZiyinEntry(selfMade).valid, true);
  const realNoYear = { ...selfMade, id: 'zy-e-002', origin: undefined };
  assert.ok(validateZiyinEntry(realNoYear).errors.includes('year is required for 真題'));
});

test('validateChengyuEntry rejects unknown level', () => {
  const entry = {
    id: 'cy-bad', level: '高中', type: '意義', source: '自編',
    question: '「一鳴驚人」的意思是？',
    options: ['一開口就震驚眾人', '從不開口', '沉默寡言', '一直哭鬧'],
    answer: '一開口就震驚眾人'
  };
  const result = validateChengyuEntry(entry);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('level must be')));
});

test('new junior formats accept a typed qformat and non-empty anchor list', () => {
  const ziyinEntry = {
    id: 'zy-中-test', level: '國中', origin: '自編', source: '自編', type: '字形',
    question: '哪一個用字正確？', options: ['佞', '倖', '倨', '佯'], answer: '佞',
    qformat: 'zixing-sentence', anchor: ['佞'],
  };
  const chengyuEntry = {
    id: 'cy-中-test', level: '國中', origin: '自編', source: '自編', type: '成語',
    question: '哪一句使用正確？', options: ['甲', '乙', '丙', '丁'], answer: '甲',
    qformat: 'usage-judge', anchor: ['一意孤行'],
  };

  assert.equal(validateZiyinEntry(ziyinEntry).valid, true);
  assert.equal(validateChengyuEntry(chengyuEntry).valid, true);
});

test('schema rejects unknown qformat and malformed anchor without breaking legacy entries', () => {
  const legacy = {
    id: 'zy-中-legacy', level: '國中', origin: '自編', source: '自編', type: '字音',
    question: '「佞臣」的「佞」正確讀音是？',
    options: ['ㄋㄧㄥˋ', 'ㄋㄧㄣˋ', 'ㄌㄧㄥˋ', 'ㄋㄧㄥˊ'], answer: 'ㄋㄧㄥˋ',
  };
  const badFormat = { ...legacy, qformat: 'reading-made-up', anchor: ['佞'] };
  const badAnchor = { ...legacy, qformat: 'reading-live', anchor: [] };

  assert.equal(validateZiyinEntry(legacy).valid, true);
  assert.equal(validateZiyinEntry(badFormat).valid, false);
  assert.equal(validateZiyinEntry(badAnchor).valid, false);
});
