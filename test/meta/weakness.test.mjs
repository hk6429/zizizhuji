import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import { recordWeakness, getWeaknessSummary } from '../../js/meta/weakness.js';

test('recordWeakness accumulates correct/wrong per type', () => {
  const meta = defaultMeta();
  recordWeakness(meta, '字音', true);
  recordWeakness(meta, '字音', false);
  recordWeakness(meta, '字音', false);
  recordWeakness(meta, '字形', true);
  assert.deepEqual(meta.weak['字音'], { correct: 1, wrong: 2 });
  assert.deepEqual(meta.weak['字形'], { correct: 1, wrong: 0 });
});

test('recordWeakness ignores missing type', () => {
  const meta = defaultMeta();
  recordWeakness(meta, undefined, true);
  recordWeakness(meta, '', false);
  assert.deepEqual(meta.weak, {});
});

test('getWeaknessSummary sorts by accuracy ascending and skips empty types', () => {
  const meta = defaultMeta();
  recordWeakness(meta, '字音', true);
  recordWeakness(meta, '字音', true);
  recordWeakness(meta, '字音', true);
  recordWeakness(meta, '字音', false); // 3/4 = 0.75
  recordWeakness(meta, '意義', false);
  recordWeakness(meta, '意義', false); // 0/2 = 0
  recordWeakness(meta, '錯別字', true); // 1/1 = 1

  const summary = getWeaknessSummary(meta);
  assert.equal(summary.length, 3);
  assert.deepEqual(summary.map(r => r.type), ['意義', '字音', '錯別字']);
  assert.equal(summary[0].accuracy, 0);
  assert.equal(summary[1].accuracy, 0.75);
  assert.equal(summary[2].accuracy, 1);
});

test('getWeaknessSummary handles empty meta.weak', () => {
  const meta = defaultMeta();
  assert.deepEqual(getWeaknessSummary(meta), []);
});
