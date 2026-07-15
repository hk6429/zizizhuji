import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkWelcomeBack } from '../js/meta/welcome-back.js';

function meta(lastLit) { return { daily: { lastLit } }; }

test('全新玩家（從未點燈）不觸發回歸迎接', () => {
  const r = checkWelcomeBack(meta(''), '2026-01-10');
  assert.equal(r.show, false);
});

test('距離上次點燈不到 3 天不觸發', () => {
  const r = checkWelcomeBack(meta('2026-01-08'), '2026-01-10');
  assert.equal(r.show, false);
  assert.equal(r.daysAway, 2);
});

test('距離上次點燈 ≥3 天觸發，回傳正確天數', () => {
  const r = checkWelcomeBack(meta('2026-01-05'), '2026-01-10');
  assert.equal(r.show, true);
  assert.equal(r.daysAway, 5);
});
