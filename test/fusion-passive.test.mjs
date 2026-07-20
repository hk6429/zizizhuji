import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fuse, chooseCubPassive, listCubs, ensureFusionState,
  CUB_PASSIVES, FUSE_COST,
} from '../js/meta/fusion-store.js';
import { LEVEL_STEP, MAX_LEVEL } from '../js/meta/pet.js';

function metaWithCub() {
  const collection = {};
  for (let i = 0; i < MAX_LEVEL * LEVEL_STEP; i++) {
    collection[`zy-${i}`] = { earnedAt: '2026-07-01', wrong: 0 };
  }
  const meta = {
    collection,
    weak: { 字音: { correct: 90, wrong: 10 } },
    pearls: { balance: 0, earnedToday: 0, earnedDate: '' },
  };
  ensureFusionState(meta).crystals.balance = FUSE_COST; // 直接灌餘額（單日上限 < FUSE_COST）
  fuse(meta, 'baize', 'kui', { rng: () => 0.5, today: '2026-07-20' });
  return meta;
}

test('CUB_PASSIVES：恰好兩個選項，effect 走 battle-adapter opts 既有欄位', () => {
  assert.equal(CUB_PASSIVES.length, 2);
  const keys = CUB_PASSIVES.map((p) => Object.keys(p.effect)[0]).sort();
  assert.deepEqual(keys, ['damageBonus', 'freeEliminate']);
});

test('chooseCubPassive：選定後寫入稚靈紀錄', () => {
  const meta = metaWithCub();
  const r = chooseCubPassive(meta, 'tiangou', 'inkfang');
  assert.equal(r.ok, true);
  assert.equal(listCubs(meta)[0].passive, 'inkfang');
});

test('chooseCubPassive：一次定終身，第二次選回 already-chosen', () => {
  const meta = metaWithCub();
  chooseCubPassive(meta, 'tiangou', 'inkfang');
  const r = chooseCubPassive(meta, 'tiangou', 'clearsight');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'already-chosen');
  assert.equal(listCubs(meta)[0].passive, 'inkfang');
});

test('chooseCubPassive：擋未擁有的稚靈與不存在的被動', () => {
  const meta = metaWithCub();
  assert.equal(chooseCubPassive(meta, 'hundun', 'inkfang').reason, 'not-owned');
  assert.equal(chooseCubPassive(meta, 'tiangou', 'nope').reason, 'bad-passive');
});
