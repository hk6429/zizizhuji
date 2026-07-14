import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  STAGES, LINES, GIFTS, addBond, getBond, pickLine, claimGift,
} from '../../js/meta/bond.js';

const D = '2026-07-14';

test('5 stages × 6 situations × 2 lines = 60 lines built in', () => {
  assert.equal(STAGES.length, 5);
  let count = 0;
  for (const stage of LINES) {
    for (const key of ['open', 'correct', 'combo3', 'wrong', 'win', 'lose']) {
      assert.ok(Array.isArray(stage[key]) && stage[key].length === 2, `missing lines for ${key}`);
      count += stage[key].length;
    }
  }
  assert.equal(count, 60);
});

test('bond gains: battle +2, win +1, combo5 +2, dailyFirst +3 (once a day)', () => {
  const meta = defaultMeta();
  addBond(meta, 'battleComplete', D);
  addBond(meta, 'win', D);
  addBond(meta, 'combo5', D);
  addBond(meta, 'dailyFirst', D);
  assert.equal(meta.bond.value, 8);
  addBond(meta, 'dailyFirst', D); // 同日第二次不給
  assert.equal(meta.bond.value, 8);
  addBond(meta, 'dailyFirst', '2026-07-15');
  assert.equal(meta.bond.value, 11);
});

test('bond multiplier (連心日 ×2) applies', () => {
  const meta = defaultMeta();
  addBond(meta, 'battleComplete', D, 2);
  assert.equal(meta.bond.value, 4);
});

test('bond caps at 100 and never decreases', () => {
  const meta = defaultMeta();
  meta.bond.value = 99;
  meta.bond.giftsClaimed = [20, 40, 60, 80];
  addBond(meta, 'combo5', D);
  assert.equal(meta.bond.value, 100);
});

test('stage up reported when crossing a threshold', () => {
  const meta = defaultMeta();
  meta.bond.value = 19;
  const r = addBond(meta, 'battleComplete', D);
  assert.ok(r.stageUp);
  assert.equal(r.stageUp.stageName, '相識');
  assert.equal(getBond(meta).stage, 1);
});

test('gift at 20 grants 30 pearls exactly once', () => {
  const meta = defaultMeta();
  meta.bond.value = 19;
  const r = addBond(meta, 'battleComplete', D);
  assert.ok(r.gift);
  assert.equal(r.gift.type, 'pearls');
  assert.equal(meta.pearls.balance, 30);
  // 不重複發
  meta.bond.value = 19; // 倒回也不會再發（已在 giftsClaimed）
  const r2 = addBond(meta, 'battleComplete', D);
  assert.equal(r2.gift, null);
  assert.equal(meta.pearls.balance, 30);
});

test('gift at 100 is the gold frame', () => {
  const meta = defaultMeta();
  meta.bond.value = 99;
  meta.bond.giftsClaimed = [20, 40, 60, 80];
  const r = addBond(meta, 'battleComplete', D);
  assert.equal(r.gift.type, 'goldFrame');
});

test('pickLine returns a string from the right stage/situation pool', () => {
  const line = pickLine(0, 'open', () => 0);
  assert.equal(line, LINES[0].open[0]);
  const line2 = pickLine(4, 'win', () => 0.9);
  assert.equal(line2, LINES[4].win[1]);
});

test('claimGift refuses below threshold or double-claim', () => {
  const meta = defaultMeta();
  assert.equal(claimGift(meta, 20).gift, null); // 值不夠
  meta.bond.value = 45;
  assert.ok(claimGift(meta, 20).gift);
  assert.equal(claimGift(meta, 20).gift, null); // 已領
  assert.equal(GIFTS.length, 5);
});
