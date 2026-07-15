import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldCheckpoint } from '../js/session-checkpoint.js';

test('shouldCheckpoint 在每 N 題整數倍觸發，0 不觸發', () => {
  assert.equal(shouldCheckpoint(0, 15), false);
  assert.equal(shouldCheckpoint(14, 15), false);
  assert.equal(shouldCheckpoint(15, 15), true);
  assert.equal(shouldCheckpoint(29, 15), false);
  assert.equal(shouldCheckpoint(30, 15), true);
});

test('shouldCheckpoint 支援自訂 everyN', () => {
  assert.equal(shouldCheckpoint(5, 5), true);
  assert.equal(shouldCheckpoint(10, 5), true);
  assert.equal(shouldCheckpoint(6, 5), false);
});
