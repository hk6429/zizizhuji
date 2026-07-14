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
