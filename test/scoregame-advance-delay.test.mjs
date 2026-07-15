import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advanceDelay } from '../js/scoregame-ui.js';

test('advanceDelay 答對用一般節奏、答錯多留時間看正解', () => {
  assert.equal(advanceDelay(true), 950);
  assert.equal(advanceDelay(false), 1850);
  assert.ok(advanceDelay(false) > advanceDelay(true));
});
