import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  GRADES, loadLeitnerState, persistLeitner, onQuestionResult, getCollection, getPolishTasks,
  getMasteryStats,
} from '../../js/meta/collection.js';
import { createLeitnerState, recordAnswer } from '../../js/leitner.js';

test('GRADES ladder is 白珠→青珠→金珠→墨玉', () => {
  assert.deepEqual(GRADES, ['白珠', '青珠', '金珠', '墨玉']);
});

test('leitner state persists through meta and restores', () => {
  const meta = defaultMeta();
  const state = createLeitnerState(['a', 'b']);
  recordAnswer(state, 'a', true); // a → box 2
  persistLeitner(meta, state);
  assert.equal(meta.leitner.a, 2);
  const restored = loadLeitnerState(meta, ['a', 'b', 'c']);
  assert.equal(restored.get('a'), 2);
  assert.equal(restored.get('b'), 1);
  assert.equal(restored.get('c'), 1); // 新題預設第 1 盒
});

test('forging at box 5 with zero wrong = 金珠', () => {
  const meta = defaultMeta();
  let events = [];
  for (const box of [2, 3, 4, 5]) {
    events = onQuestionResult(meta, 'q1', true, box).events;
  }
  const forged = events.find(e => e.type === 'pearlForged');
  assert.ok(forged);
  assert.equal(forged.payload.gradeName, '金珠');
});

test('forging with 1 wrong = 青珠, with 2+ wrong = 白珠', () => {
  const meta = defaultMeta();
  onQuestionResult(meta, 'q1', false, 1);
  let ev = null;
  for (const box of [2, 3, 4, 5]) ev = onQuestionResult(meta, 'q1', true, box).events;
  assert.equal(ev.find(e => e.type === 'pearlForged').payload.gradeName, '青珠');

  onQuestionResult(meta, 'q2', false, 1);
  onQuestionResult(meta, 'q2', false, 1);
  for (const box of [2, 3, 4, 5]) ev = onQuestionResult(meta, 'q2', true, box).events;
  assert.equal(ev.find(e => e.type === 'pearlForged').payload.gradeName, '白珠');
});

function forgeGold(meta, id) {
  for (const box of [2, 3, 4, 5]) onQuestionResult(meta, id, true, box);
}

test('earned pearl dusts on wrong: box drops to 3, not 1, and never removed', () => {
  const meta = defaultMeta();
  forgeGold(meta, 'q1');
  const { events } = onQuestionResult(meta, 'q1', false, 1); // leitner 想降回 1
  const dusted = events.find(e => e.type === 'pearlDusted');
  assert.ok(dusted);
  assert.equal(dusted.payload.setBox, 3);
  assert.equal(meta.leitner.q1, 3);
  assert.equal(getCollection(meta).earned.length, 1); // 珠還在
  assert.equal(getCollection(meta).dustyCount, 1);
});

test('polishing: 2 consecutive corrects restore box 5; a wrong resets progress', () => {
  const meta = defaultMeta();
  forgeGold(meta, 'q1');
  onQuestionResult(meta, 'q1', false, 1); // dusty
  onQuestionResult(meta, 'q1', true, 4);
  onQuestionResult(meta, 'q1', false, 1); // 中斷，重來
  assert.deepEqual(getPolishTasks(meta), [{ id: 'q1', remaining: 2 }]);
  onQuestionResult(meta, 'q1', true, 4);
  const { events } = onQuestionResult(meta, 'q1', true, 5);
  const polished = events.find(e => e.type === 'pearlPolished');
  assert.ok(polished);
  assert.equal(polished.payload.setBox, 5);
  assert.equal(meta.leitner.q1, 5);
  assert.equal(getCollection(meta).dustyCount, 0);
});

test('grade up: 3 consecutive corrects after forging, up to 墨玉 cap', () => {
  const meta = defaultMeta();
  forgeGold(meta, 'q1'); // 金珠 (grade 2)
  onQuestionResult(meta, 'q1', true, 5);
  onQuestionResult(meta, 'q1', true, 5);
  const { events } = onQuestionResult(meta, 'q1', true, 5);
  const up = events.find(e => e.type === 'gradeUp');
  assert.ok(up);
  assert.equal(up.payload.gradeName, '墨玉');
  // 已是頂階，再連對不再升
  for (let i = 0; i < 3; i++) {
    const r = onQuestionResult(meta, 'q1', true, 5);
    assert.ok(!r.events.some(e => e.type === 'gradeUp'));
  }
});

test('getCollection tallies grades', () => {
  const meta = defaultMeta();
  forgeGold(meta, 'q1');
  onQuestionResult(meta, 'q2', false, 1);
  for (const box of [2, 3, 4, 5]) onQuestionResult(meta, 'q2', true, box);
  const c = getCollection(meta);
  assert.equal(c.earned.length, 2);
  assert.equal(c.counts[2], 1); // 金
  assert.equal(c.counts[1], 1); // 青
});

test('getMasteryStats: 已認識＝煉成、精熟＝青珠以上，題庫外的 id 不計入', () => {
  const meta = defaultMeta();
  forgeGold(meta, 'q1'); // 金珠（精熟）
  onQuestionResult(meta, 'q2', false, 1);
  for (const box of [2, 3, 4, 5]) onQuestionResult(meta, 'q2', true, box); // 青珠（精熟）
  onQuestionResult(meta, 'q3', false, 1);
  onQuestionResult(meta, 'q3', false, 2);
  for (const box of [3, 4, 5]) onQuestionResult(meta, 'q3', true, box); // 白珠（已認識但未精熟）
  onQuestionResult(meta, 'not-in-bank', false, 1); // 已練但不在傳入題庫內，不應計入

  const bank = [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }, { id: 'q4' }];
  const stats = getMasteryStats(meta, bank);
  assert.deepEqual(stats, { total: 4, known: 3, mastered: 2, remaining: 1 });
});
