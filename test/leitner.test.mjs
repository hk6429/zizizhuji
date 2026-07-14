import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLeitnerState, recordAnswer, nextQuestionId } from '../js/leitner.js';

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

test('recordAnswer resets box to 1 on incorrect', () => {
  const state = createLeitnerState(['a']);
  recordAnswer(state, 'a', true);
  recordAnswer(state, 'a', true);
  assert.equal(state.get('a'), 3);
  recordAnswer(state, 'a', false);
  assert.equal(state.get('a'), 1);
});

test('nextQuestionId prefers ids with the lowest box', () => {
  const state = createLeitnerState(['a', 'b']);
  recordAnswer(state, 'a', true);
  recordAnswer(state, 'a', true);
  // a is box 3, b is box 1 -> b must be picked
  const picked = nextQuestionId(state, ['a', 'b']);
  assert.equal(picked, 'b');
});
