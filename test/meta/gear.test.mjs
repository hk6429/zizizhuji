import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import { earnPearls, getBalance } from '../../js/meta/economy.js';
import { GEAR_LIST, buyGear, setLoadout, getModifiers } from '../../js/meta/gear.js';

test('12 gears priced 4×80 + 4×150 + 4×300 = 2120 total', () => {
  assert.equal(GEAR_LIST.length, 12);
  const prices = GEAR_LIST.map(g => g.price);
  assert.equal(prices.filter(p => p === 80).length, 4);
  assert.equal(prices.filter(p => p === 150).length, 4);
  assert.equal(prices.filter(p => p === 300).length, 4);
  assert.equal(prices.reduce((a, b) => a + b, 0), 2120);
});

test('buyGear: insufficient pearls refused, then succeeds, no double-buy', () => {
  const meta = defaultMeta();
  assert.equal(buyGear(meta, 'langhao').reason, 'pearls');
  earnPearls(meta, 100, 'achievement', '2026-07-14');
  const r = buyGear(meta, 'langhao');
  assert.equal(r.ok, true);
  assert.equal(getBalance(meta), 20);
  assert.equal(buyGear(meta, 'langhao').reason, 'owned');
  assert.equal(buyGear(meta, 'nonexistent').reason, 'not-found');
});

test('setLoadout enforces ownership, max 2, uniqueness', () => {
  const meta = defaultMeta();
  earnPearls(meta, 500, 'achievement', '2026-07-14');
  buyGear(meta, 'langhao');
  buyGear(meta, 'youyan');
  buyGear(meta, 'chengxin');
  assert.equal(setLoadout(meta, ['langhao', 'duanyan']).ok, false); // 未擁有
  assert.equal(setLoadout(meta, ['langhao', 'youyan', 'chengxin']).ok, false); // 超過 2
  assert.equal(setLoadout(meta, ['langhao', 'langhao']).ok, false); // 重複
  assert.equal(setLoadout(meta, ['langhao', 'youyan']).ok, true);
  assert.deepEqual(meta.gear.loadout, ['langhao', 'youyan']);
});

test('getModifiers defaults mirror battle.js constants', () => {
  const mods = getModifiers(defaultMeta());
  assert.equal(mods.comboThreshold, 3);
  assert.equal(mods.comboBonusDamage, 15);
  assert.equal(mods.maxHp, 100);
  assert.equal(mods.missReflect, 0);
});

test('getModifiers merges the two equipped gears', () => {
  const meta = defaultMeta();
  earnPearls(meta, 500, 'achievement', '2026-07-14');
  buyGear(meta, 'langhao'); // 門檻 2
  buyGear(meta, 'huying'); // 字音 +2 — 需 300
  earnPearls(meta, 300, 'achievement', '2026-07-14');
  buyGear(meta, 'chengxin');
  setLoadout(meta, ['langhao', 'huying']);
  let mods = getModifiers(meta);
  assert.equal(mods.comboThreshold, 2);
  assert.equal(mods.typeBonus['字音'], 2);
  assert.equal(mods.maxHp, 100); // 澄心紙沒上場
  setLoadout(meta, ['chengxin']);
  mods = getModifiers(meta);
  assert.equal(mods.maxHp, 120);
  assert.equal(mods.comboThreshold, 3);
});
