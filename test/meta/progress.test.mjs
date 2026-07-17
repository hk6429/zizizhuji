import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import { RANKS, addXp, getProgress } from '../../js/meta/progress.js';

test('ten ranks with the designed thresholds', () => {
  assert.deepEqual(RANKS.map(r => r.threshold), [0, 100, 300, 700, 1500, 3000, 5500, 9000, 15000, 24000]);
  assert.equal(RANKS[0].name, '蒙童');
  assert.equal(RANKS[7].name, '翰林');
  assert.equal(RANKS[9].name, '文曲星');
});

test('addXp accumulates and levels up exactly at thresholds', () => {
  const meta = defaultMeta();
  let r = addXp(meta, 99);
  assert.equal(r.leveledUp, false);
  r = addXp(meta, 1); // 100 → 識字生
  assert.equal(r.leveledUp, true);
  assert.equal(r.newRank.name, '識字生');
  assert.ok(r.newRank.blessing.length > 0);
});

test('a big xp jump can skip ranks and reports the final one', () => {
  const meta = defaultMeta();
  const r = addXp(meta, 800); // 直上誦典生
  assert.equal(r.leveledUp, true);
  assert.equal(r.newRank.name, '誦典生');
  assert.equal(meta.xp.rank, 3);
});

test('getProgress reports next threshold, null at max rank', () => {
  const meta = defaultMeta();
  assert.equal(getProgress(meta).nextThreshold, 100);
  addXp(meta, 10000);
  let p = getProgress(meta);
  assert.equal(p.rankName, '翰林');
  assert.equal(p.nextThreshold, 15000);
  addXp(meta, 20000); // 累計 30000，超過文曲星門檻，應到頂
  p = getProgress(meta);
  assert.equal(p.rankName, '文曲星');
  assert.equal(p.nextThreshold, null);
});

test('addXp with zero or negative amount is a no-op', () => {
  const meta = defaultMeta();
  const r = addXp(meta, 0);
  assert.equal(r.leveledUp, false);
  assert.equal(meta.xp.value, 0);
});
