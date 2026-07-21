import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import { DAILY_EARN_CAP, earnPearls, spendPearls, getBalance } from '../../js/meta/economy.js';

const D = '2026-07-14';

test('DAILY_EARN_CAP is 300', () => {
  assert.equal(DAILY_EARN_CAP, 300);
});

test('earnPearls adds to balance and daily counter', () => {
  const meta = defaultMeta();
  const r = earnPearls(meta, 5, 'practice-answer', D);
  assert.equal(r.earned, 5);
  assert.equal(r.capped, false);
  assert.equal(getBalance(meta), 5);
  assert.equal(meta.pearls.earnedToday, 5);
  assert.equal(meta.pearls.earnedDate, D);
});

test('earnPearls caps at DAILY_EARN_CAP per day and reports capped', () => {
  const meta = defaultMeta();
  earnPearls(meta, DAILY_EARN_CAP - 5, 'battle-win', D);
  const r = earnPearls(meta, 10, 'battle-win', D);
  assert.equal(r.earned, 5);
  assert.equal(r.capped, true);
  assert.equal(getBalance(meta), DAILY_EARN_CAP);
  const r2 = earnPearls(meta, 3, 'battle-win', D);
  assert.equal(r2.earned, 0);
  assert.equal(r2.capped, true);
});

test('achievement rewards bypass the daily cap', () => {
  const meta = defaultMeta();
  earnPearls(meta, 120, 'practice-answer', D);
  const r = earnPearls(meta, 30, 'achievement', D);
  assert.equal(r.earned, 30);
  assert.equal(r.capped, false);
  assert.equal(getBalance(meta), 150);
  assert.equal(meta.pearls.earnedToday, 120); // exempt earnings not counted
});

test('daily counter resets on a new day', () => {
  const meta = defaultMeta();
  earnPearls(meta, 120, 'practice-answer', D);
  const r = earnPearls(meta, 10, 'practice-answer', '2026-07-15');
  assert.equal(r.earned, 10);
  assert.equal(meta.pearls.earnedToday, 10);
  assert.equal(getBalance(meta), 130);
});

test('earnPearls with non-positive amount is a no-op', () => {
  const meta = defaultMeta();
  const r = earnPearls(meta, 0, 'x', D);
  assert.equal(r.earned, 0);
  assert.equal(getBalance(meta), 0);
});

test('spendPearls succeeds with enough balance', () => {
  const meta = defaultMeta();
  earnPearls(meta, 100, 'practice-answer', D);
  const r = spendPearls(meta, 80, 'gear');
  assert.equal(r.ok, true);
  assert.equal(getBalance(meta), 20);
});

test('spendPearls refuses when balance insufficient', () => {
  const meta = defaultMeta();
  earnPearls(meta, 50, 'practice-answer', D);
  const r = spendPearls(meta, 80, 'gear');
  assert.equal(r.ok, false);
  assert.equal(getBalance(meta), 50);
});
