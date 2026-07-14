import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  MILESTONE_LETTERS, zoneOf, purify, getProgress, pendingMilestones, markMilestoneSeen,
} from '../../js/meta/world.js';

test('zoneOf maps chengyu by id prefix and ziyin by type', () => {
  assert.equal(zoneOf({ id: 'cy-真-001', type: '意義' }), 'chengyu');
  assert.equal(zoneOf({ id: 'zy-103-001', type: '字音' }), 'yin');
  assert.equal(zoneOf({ id: 'zy-103-002', type: '字形' }), 'xing');
});

test('purify is idempotent per question and counts by zone', () => {
  const meta = defaultMeta();
  assert.equal(purify(meta, 'zy-1', 'yin').newlyPurified, true);
  assert.equal(purify(meta, 'zy-1', 'yin').newlyPurified, false);
  assert.equal(meta.world.purified.length, 1);
  assert.equal(meta.world.byZone.yin, 1);
});

test('getProgress computes totals and per-zone percentages', () => {
  const meta = defaultMeta();
  purify(meta, 'zy-1', 'yin');
  purify(meta, 'cy-1', 'chengyu');
  const p = getProgress(meta, { yin: 10, xing: 10, chengyu: 20 });
  assert.equal(p.total, 40);
  assert.equal(p.done, 2);
  assert.equal(p.byZone.yin.pct, 10);
  assert.equal(p.byZone.chengyu.pct, 5);
  assert.equal(p.byZone.xing.done, 0);
});

test('milestone letters: 13 letters, all texts ≤50 chars', () => {
  assert.equal(MILESTONE_LETTERS.length, 13);
  for (const l of MILESTONE_LETTERS) assert.ok(l.text.length <= 50, `${l.id} too long`);
});

test('pendingMilestones surfaces unseen letters once thresholds hit', () => {
  const meta = defaultMeta();
  const totals = { yin: 10, xing: 10, chengyu: 10 };
  purify(meta, 'a', 'yin'); // yin 10%
  let pending = pendingMilestones(meta, totals);
  assert.deepEqual(pending.map(l => l.id), ['yin-10']);
  markMilestoneSeen(meta, 'yin-10');
  assert.deepEqual(pendingMilestones(meta, totals), []);
  purify(meta, 'b', 'yin');
  purify(meta, 'c', 'yin'); // yin 30%
  pending = pendingMilestones(meta, totals);
  assert.deepEqual(pending.map(l => l.id), ['yin-30']);
});

test('grand letter appears only when everything is purified', () => {
  const meta = defaultMeta();
  const totals = { yin: 1, xing: 1, chengyu: 1 };
  purify(meta, 'a', 'yin');
  purify(meta, 'b', 'xing');
  let ids = pendingMilestones(meta, totals).map(l => l.id);
  assert.ok(!ids.includes('grand'));
  purify(meta, 'c', 'chengyu');
  ids = pendingMilestones(meta, totals).map(l => l.id);
  assert.ok(ids.includes('grand'));
});
