import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldWaitForNext } from '../js/answer-flow.js';

test('對戰答錯後停留到玩家手動按下一題，答對維持自動快節奏', () => {
  assert.equal(shouldWaitForNext(false, false), true);
  assert.equal(shouldWaitForNext(true, false), false);
  assert.equal(shouldWaitForNext(true, true), true);
});
