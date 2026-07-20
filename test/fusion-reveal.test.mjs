import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVEAL_RIDDLES, getRevealState, answerRevealRiddle, getFusionPreview,
} from '../js/meta/fusion-store.js';

test('REVEAL_RIDDLES：三類別各一題、四選項、答案索引合法', () => {
  assert.deepEqual(REVEAL_RIDDLES.map((r) => r.category).sort(), ['字音', '成語', '混合'].sort());
  for (const r of REVEAL_RIDDLES) {
    assert.equal(r.options.length, 4);
    assert.ok(r.answer >= 0 && r.answer < 4);
    assert.ok(r.question.length >= 10);
  }
});

test('未揭曉前 preview 是未知；答對隱藏題後看得見下一隻稚靈', () => {
  const meta = {};
  assert.equal(getFusionPreview(meta, '字音').known, false);
  const riddle = REVEAL_RIDDLES.find((r) => r.category === '字音');
  const r = answerRevealRiddle(meta, '字音', riddle.answer, '2026-07-20');
  assert.equal(r.correct, true);
  const p = getFusionPreview(meta, '字音');
  assert.equal(p.known, true);
  assert.equal(p.cub.id, 'tiangou');
  assert.ok(Array.isArray(p.cub.titles));
});

test('答錯鎖到隔天：當天再答回 locked-today，隔天可再試', () => {
  const meta = {};
  const riddle = REVEAL_RIDDLES.find((r) => r.category === '字音');
  const wrongIdx = (riddle.answer + 1) % 4;
  const r1 = answerRevealRiddle(meta, '字音', wrongIdx, '2026-07-20');
  assert.equal(r1.correct, false);
  assert.equal(getRevealState(meta, '字音', '2026-07-20').lockedToday, true);
  assert.equal(answerRevealRiddle(meta, '字音', riddle.answer, '2026-07-20').reason, 'locked-today');
  assert.equal(getRevealState(meta, '字音', '2026-07-21').lockedToday, false);
  assert.equal(answerRevealRiddle(meta, '字音', riddle.answer, '2026-07-21').correct, true);
});

test('已揭曉後再答回 already-revealed；revealed 狀態下 riddle 為 null', () => {
  const meta = {};
  const riddle = REVEAL_RIDDLES.find((r) => r.category === '成語');
  answerRevealRiddle(meta, '成語', riddle.answer, '2026-07-20');
  assert.equal(answerRevealRiddle(meta, '成語', riddle.answer, '2026-07-20').reason, 'already-revealed');
  assert.equal(getRevealState(meta, '成語', '2026-07-20').riddle, null);
});
