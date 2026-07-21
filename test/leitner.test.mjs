import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeitnerState, recordAnswer, nextQuestionId, boostSiblings } from '../js/leitner.js';

test('createLeitnerState initializes every id at box 1', () => {
  const state = createLeitnerState(['a', 'b', 'c']);
  assert.equal(state.get('a'), 1);
  assert.equal(state.get('b'), 1);
  assert.equal(state.get('c'), 1);
});

test('recordAnswer increments box on correct, caps at 5', () => {
  const state = createLeitnerState(['a']);
  for (let i = 0; i < 10; i++) recordAnswer(state, 'a', true);
  assert.equal(state.get('a'), 5);
});

test('recordAnswer drops box by 2 (not to 1) on incorrect', () => {
  const state = createLeitnerState(['a']);
  recordAnswer(state, 'a', true);
  recordAnswer(state, 'a', true);
  assert.equal(state.get('a'), 3);
  recordAnswer(state, 'a', false);
  assert.equal(state.get('a'), 1); // 3-2=1，剛好貼底
});

test('recordAnswer never drops below box 1 even from a high box', () => {
  const state = createLeitnerState(['a']);
  for (let i = 0; i < 4; i++) recordAnswer(state, 'a', true);
  assert.equal(state.get('a'), 5);
  recordAnswer(state, 'a', false);
  assert.equal(state.get('a'), 3); // 5-2=3，不是打回 1
});

test('nextQuestionId breaks box ties by difficulty (易 before 難) when byId is given', () => {
  const state = createLeitnerState(['a', 'b']);
  const byId = new Map([
    ['a', { difficulty: '難' }],
    ['b', { difficulty: '易' }],
  ]);
  const picked = nextQuestionId(state, ['a', 'b'], byId);
  assert.equal(picked, 'b');
});

test('nextQuestionId prefers ids with the lowest box', () => {
  const state = createLeitnerState(['a', 'b']);
  recordAnswer(state, 'a', true);
  recordAnswer(state, 'a', true);
  // a is box 3, b is box 1 -> b must be picked
  const picked = nextQuestionId(state, ['a', 'b']);
  assert.equal(picked, 'b');
});

test('boostSiblings drops same-char sibling boxes by 1 (default), floors at 1', () => {
  const state = createLeitnerState(['a', 'b', 'c']);
  for (let i = 0; i < 3; i++) recordAnswer(state, 'b', true); // b -> box 4
  recordAnswer(state, 'c', true); // c -> box 2
  boostSiblings(state, ['b', 'c']);
  assert.equal(state.get('b'), 3); // 4-1
  assert.equal(state.get('c'), 1); // 2-1
});

test('boostSiblings ignores ids not in state and tolerates empty/undefined', () => {
  const state = createLeitnerState(['a']);
  recordAnswer(state, 'a', true); // box 2
  boostSiblings(state, ['zzz-not-here']);
  boostSiblings(state, undefined);
  assert.equal(state.get('a'), 2); // 未受影響
});
