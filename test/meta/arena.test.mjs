import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  AVATARS, getDailyQuestionIds, rolloverIfNeeded, submitEntry, getBoard, getHistory, buildBroadcast,
} from '../../js/meta/arena.js';

const IDS = Array.from({ length: 50 }, (_, i) => `q-${i}`);

test('12 preset avatars', () => {
  assert.equal(AVATARS.length, 12);
});

test('daily question ids: deterministic for a date, 10 unique ids from the pool', () => {
  const a = getDailyQuestionIds(IDS, '2026-07-14');
  const b = getDailyQuestionIds(IDS, '2026-07-14');
  assert.deepEqual(a, b);
  assert.equal(a.length, 10);
  assert.equal(new Set(a).size, 10);
  for (const id of a) assert.ok(IDS.includes(id));
  const c = getDailyQuestionIds(IDS, '2026-07-15');
  assert.notDeepEqual(a, c); // 換日換題
});

test('submitEntry ranks by correct desc then time asc', () => {
  const meta = defaultMeta();
  submitEntry(meta, { name: '小明', correct: 8, timeMs: 90000 }, '2026-07-14');
  submitEntry(meta, { name: '小華', correct: 9, timeMs: 120000 }, '2026-07-14');
  const r = submitEntry(meta, { name: '小美', correct: 8, timeMs: 80000 }, '2026-07-14');
  assert.equal(r.rank, 2); // 同 8 題比用時，小美贏小明
  const board = getBoard(meta);
  assert.deepEqual(board.entries.map(e => e.name), ['小華', '小美', '小明']);
});

test('same name same day keeps only the best run', () => {
  const meta = defaultMeta();
  submitEntry(meta, { name: '小明', correct: 5, timeMs: 100000 }, '2026-07-14');
  submitEntry(meta, { name: '小明', correct: 7, timeMs: 110000 }, '2026-07-14');
  submitEntry(meta, { name: '小明', correct: 6, timeMs: 50000 }, '2026-07-14'); // 較差，不覆蓋
  const board = getBoard(meta);
  assert.equal(board.entries.length, 1);
  assert.equal(board.entries[0].correct, 7);
});

test('week rollover archives last week top3 and keeps only 4 weeks', () => {
  const meta = defaultMeta();
  submitEntry(meta, { name: '小明', correct: 9, timeMs: 1000 }, '2026-07-14');
  rolloverIfNeeded(meta, '2026-07-20'); // 下週一
  assert.equal(meta.arena.entries.length, 0);
  const h = getHistory(meta);
  assert.equal(h.length, 1);
  assert.equal(h[0].top3[0].name, '小明');
  // 塞 5 週只留 4 週
  const mondays = ['2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17'];
  for (const d of mondays) {
    submitEntry(meta, { name: 'x', correct: 1, timeMs: 1 }, d);
    rolloverIfNeeded(meta, '2026-08-24');
    meta.arena.week = ''; // 強迫下一次 submit 重設週
  }
  assert.ok(getHistory(meta).length <= 4);
});

test('buildBroadcast produces herald lines with the weekly champion', () => {
  const meta = defaultMeta();
  const empty = buildBroadcast(meta);
  assert.equal(empty.champion, null);
  submitEntry(meta, { name: '小華', correct: 10, timeMs: 60000 }, '2026-07-14');
  submitEntry(meta, { name: '小明', correct: 8, timeMs: 70000 }, '2026-07-14');
  const b = buildBroadcast(meta);
  assert.equal(b.champion, '小華');
  assert.equal(b.championTitle, '本週珠王');
  assert.ok(b.heraldLines.some(l => l.includes('小華')));
  assert.equal(b.top3.length, 2);
});
