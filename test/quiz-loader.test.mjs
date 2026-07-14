import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQuizBank } from '../js/quiz-loader.js';

test('loadQuizBank splits valid and invalid ziyin entries', () => {
  const raw = [
    { id: 'zy-1', level: '國小', year: 113, source: 'x', type: '字音',
      question: 'q', options: ['a', 'b', 'c', 'd'], answer: 'a', note: '' },
    { id: 'zy-2', level: '國小', year: 113, source: 'x', type: '字音',
      question: 'q', options: ['a', 'b', 'c'], answer: 'a', note: '' } // bad: 3 options
  ];
  const { usable, rejected } = loadQuizBank(raw, 'ziyin');
  assert.equal(usable.length, 1);
  assert.equal(usable[0].id, 'zy-1');
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].entry.id, 'zy-2');
});

test('loadQuizBank rejects chengyu entries with bad source tag', () => {
  const raw = [
    { id: 'cy-1', level: '國小', type: '意義', source: '真題',
      question: 'q', options: ['a', 'b', 'c', 'd'], answer: 'a' },
    { id: 'cy-2', level: '國小', type: '意義', source: '不明',
      question: 'q', options: ['a', 'b', 'c', 'd'], answer: 'a' }
  ];
  const { usable, rejected } = loadQuizBank(raw, 'chengyu');
  assert.equal(usable.length, 1);
  assert.equal(rejected.length, 1);
});

test('loadQuizBank throws on unknown kind', () => {
  assert.throws(() => loadQuizBank([], 'unknown'), /unknown kind/);
});
