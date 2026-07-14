import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattleState, applyAnswer, isBattleOver } from '../js/battle.js';

test('createBattleState starts both sides at 100 hp, 0 combo', () => {
  const state = createBattleState();
  assert.deepEqual(state, { hpA: 100, hpB: 100, comboA: 0, comboB: 0 });
});

test('applyAnswer: correct answer from A damages B by 10 and increments comboA', () => {
  let state = createBattleState();
  state = applyAnswer(state, 'A', true);
  assert.equal(state.hpB, 90);
  assert.equal(state.hpA, 100);
  assert.equal(state.comboA, 1);
});

test('applyAnswer: combo of 3+ adds bonus damage (15 instead of 10)', () => {
  let state = createBattleState();
  state = applyAnswer(state, 'A', true); // combo 1 -> dmg 10, hpB 90
  state = applyAnswer(state, 'A', true); // combo 2 -> dmg 10, hpB 80
  state = applyAnswer(state, 'A', true); // combo 3 -> dmg 15, hpB 65
  assert.equal(state.hpB, 65);
  assert.equal(state.comboA, 3);
});

test('applyAnswer: incorrect answer resets that side\'s combo and deals no damage', () => {
  let state = createBattleState();
  state = applyAnswer(state, 'A', true);
  state = applyAnswer(state, 'A', false);
  assert.equal(state.comboA, 0);
  assert.equal(state.hpB, 90); // unchanged from the miss
});

test('isBattleOver returns true once either side reaches 0 hp', () => {
  let state = createBattleState();
  for (let i = 0; i < 20; i++) state = applyAnswer(state, 'A', true);
  assert.equal(isBattleOver(state), true);
});
