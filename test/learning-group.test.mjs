import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLearningGroup, createLearningScheduler } from '../js/learning-group.js';
import { recordAnswer } from '../js/leitner.js';

test('學習組優先接續已在複習中的題目，排除已煉成題，並限制為 20 題', () => {
  const ids = Array.from({ length: 30 }, (_, i) => `q${i + 1}`);
  const leitner = new Map(ids.map((id) => [id, 1]));
  leitner.set('q1', 5);
  leitner.set('q2', 4);
  leitner.set('q3', 3);
  leitner.set('q4', 2);

  const group = buildLearningGroup(ids, leitner, {
    size: 20,
    shuffle: (items) => items,
  });

  assert.equal(group.length, 20);
  assert.deepEqual(group.slice(0, 3), ['q2', 'q3', 'q4']);
  assert.ok(!group.includes('q1'));
  assert.equal(new Set(group).size, group.length);
});

test('換輪時保留尚未煉成的組員，只用新題補上已煉成的空位', () => {
  const ids = Array.from({ length: 25 }, (_, i) => `q${i + 1}`);
  const current = ids.slice(0, 20);
  const leitner = new Map(ids.map((id) => [id, 1]));
  for (const id of current) leitner.set(id, 2);
  leitner.set('q1', 5);
  leitner.set('q21', 4);

  const next = buildLearningGroup(ids, leitner, {
    current,
    size: 20,
    shuffle: (items) => items,
  });

  assert.deepEqual(next.slice(0, 19), current.slice(1));
  assert.equal(next[19], 'q21');
  assert.ok(!next.includes('q1'));
});

test('新玩家連續答對 65 題後，至少有 5 題升到第 5 盒', () => {
  const ids = Array.from({ length: 100 }, (_, i) => `q${i + 1}`);
  const leitner = new Map(ids.map((id) => [id, 1]));
  const scheduler = createLearningScheduler(ids, leitner, {
    size: 20,
    shuffle: (items) => items,
  });

  for (let answered = 0; answered < 65; answered += 1) {
    const { id } = scheduler.next((items) => items[0]);
    assert.ok(id);
    recordAnswer(leitner, id, true);
    scheduler.record(id, true);
  }

  assert.ok([...leitner.values()].filter((box) => box === 5).length >= 5);
});

test('所選題庫全數煉成後仍可繼續複習，不會出現空題目', () => {
  const ids = ['q1', 'q2', 'q3'];
  const leitner = new Map(ids.map((id) => [id, 5]));
  const scheduler = createLearningScheduler(ids, leitner, {
    size: 20,
    shuffle: (items) => items,
  });

  assert.equal(scheduler.next((items) => items[0]).id, 'q1');
});
