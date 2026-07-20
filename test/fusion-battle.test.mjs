import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fuse, chooseCubPassive, setActiveCub, clearActiveCub, getCubBattleMods,
  ensureFusionState, FUSE_COST,
} from '../js/meta/fusion-store.js';
import { createBattleContext, createBattleStateEx, applyAnswerEx } from '../js/meta/battle-adapter.js';
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
    gear: { owned: [], loadout: [] }, arts: { unlocked: [], equipped: null, battlesWon: 0 },
  };
  ensureFusionState(meta).crystals.balance = FUSE_COST; // 直接灌餘額（單日上限 < FUSE_COST）
  fuse(meta, 'baize', 'kui', { rng: () => 0.5, today: '2026-07-20' });
  return meta;
}

test('setActiveCub / clearActiveCub：只有擁有的稚靈能隨行', () => {
  const meta = metaWithCub();
  assert.equal(setActiveCub(meta, 'hundun').reason, 'not-owned');
  assert.equal(setActiveCub(meta, 'tiangou').ok, true);
  assert.equal(meta.fusion.activeCub, 'tiangou');
  clearActiveCub(meta);
  assert.equal(meta.fusion.activeCub, null);
});

test('getCubBattleMods：未選被動＝全 0；選墨牙＝+1 傷害；未隨行＝全 0', () => {
  const meta = metaWithCub();
  setActiveCub(meta, 'tiangou');
  assert.deepEqual(getCubBattleMods(meta), { damageBonus: 0, freeEliminate: 0 });
  chooseCubPassive(meta, 'tiangou', 'inkfang');
  assert.deepEqual(getCubBattleMods(meta), { damageBonus: 1, freeEliminate: 0 });
  clearActiveCub(meta);
  assert.deepEqual(getCubBattleMods(meta), { damageBonus: 0, freeEliminate: 0 });
});

test('端對端：稚靈 +1 傷害真的灌進 battle-adapter opts 並反映在 hpB', () => {
  const meta = metaWithCub();
  setActiveCub(meta, 'tiangou');
  chooseCubPassive(meta, 'tiangou', 'inkfang');
  const mods = getCubBattleMods(meta);
  const withCub = createBattleContext(meta, { damageBonus: mods.damageBonus, freeEliminate: mods.freeEliminate });
  const without = createBattleContext(meta, { damageBonus: 0, freeEliminate: 0 });
  const s1 = applyAnswerEx(createBattleStateEx(withCub), 'A', true, withCub).state;
  const s2 = applyAnswerEx(createBattleStateEx(without), 'A', true, without).state;
  assert.equal(s2.hpB - s1.hpB, 1); // 稚靈隨行恰好多 1 點傷害
});

test('澄目被動折成 freeEliminate', () => {
  const meta = metaWithCub();
  setActiveCub(meta, 'tiangou');
  meta.fusion.cubs.tiangou.passive = 'clearsight';
  assert.deepEqual(getCubBattleMods(meta), { damageBonus: 0, freeEliminate: 1 });
});
