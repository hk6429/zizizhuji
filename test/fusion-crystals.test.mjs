import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  earnCrystals, spendCrystals, getCrystalBalance, ensureFusionState, CRYSTAL_DAILY_CAP,
} from '../js/meta/fusion-store.js';

function freshMeta() { return {}; }

test('earnCrystals：正常入帳並累計 earnedToday', () => {
  const meta = freshMeta();
  const r = earnCrystals(meta, 3, '2026-07-20');
  assert.equal(r.earned, 3);
  assert.equal(r.capped, false);
  assert.equal(getCrystalBalance(meta), 3);
  assert.equal(meta.fusion.crystals.earnedToday, 3);
});

test('earnCrystals：單日超過 CRYSTAL_DAILY_CAP 會截斷並回報 capped', () => {
  const meta = freshMeta();
  earnCrystals(meta, CRYSTAL_DAILY_CAP, '2026-07-20');
  const r = earnCrystals(meta, 5, '2026-07-20');
  assert.equal(r.earned, 0);
  assert.equal(r.capped, true);
  assert.equal(getCrystalBalance(meta), CRYSTAL_DAILY_CAP);
});

test('earnCrystals：跨日重置 earnedToday', () => {
  const meta = freshMeta();
  earnCrystals(meta, CRYSTAL_DAILY_CAP, '2026-07-20');
  const r = earnCrystals(meta, 2, '2026-07-21');
  assert.equal(r.earned, 2);
  assert.equal(getCrystalBalance(meta), CRYSTAL_DAILY_CAP + 2);
});

test('earnCrystals：非法金額（0、負數、NaN）不入帳', () => {
  const meta = freshMeta();
  for (const bad of [0, -3, NaN]) {
    const r = earnCrystals(meta, bad, '2026-07-20');
    assert.equal(r.earned, 0);
  }
  assert.equal(getCrystalBalance(meta), 0);
});

test('spendCrystals：餘額足夠才扣，不足回 ok:false 且不動餘額', () => {
  const meta = freshMeta();
  earnCrystals(meta, 5, '2026-07-20');
  assert.equal(spendCrystals(meta, 3).ok, true);
  assert.equal(getCrystalBalance(meta), 2);
  assert.equal(spendCrystals(meta, 3).ok, false);
  assert.equal(getCrystalBalance(meta), 2);
});

test('ensureFusionState：舊存檔缺 fusion 欄位時就地補齊全形狀', () => {
  const meta = { pearls: { balance: 0 } };
  const s = ensureFusionState(meta);
  assert.deepEqual(s.crystals, { balance: 0, earnedToday: 0, earnedDate: '' });
  assert.deepEqual(s.cubs, {});
  assert.deepEqual(s.revealed, {});
  assert.deepEqual(s.riddleTried, {});
  assert.equal(s.activeCub, null);
});

import { setStorageBackend } from '../js/meta/store.js';
import { initSession, onPracticeAnswer } from '../js/meta/kernel.js';

test('kernel：答對曾錯過的題掉 1 墨晶；首見題答對不掉', () => {
  const mem = new Map();
  setStorageBackend({
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => { mem.set(k, String(v)); },
    removeItem: (k) => { mem.delete(k); },
  });
  const banks = { ziyin: [{ id: 'zy-1', type: '字音' }, { id: 'zy-2', type: '字音' }], chengyu: [] };
  const { ctx } = initSession('2026-07-20', banks, { rng: () => 0.99 }); // rng 0.99 避開奇遇
  onPracticeAnswer(ctx, 'zy-1', false);            // 先答錯，累出 wrong 紀錄
  const r1 = onPracticeAnswer(ctx, 'zy-1', true);  // 再答對 → 掉墨晶
  assert.ok(r1.events.some((e) => e.type === 'crystalEarned'));
  const r2 = onPracticeAnswer(ctx, 'zy-2', true);  // 首見答對 → 不掉
  assert.ok(!r2.events.some((e) => e.type === 'crystalEarned'));
});
