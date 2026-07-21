import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petLevel, PET_EQUIP, MAX_LEVEL, PETS } from '../js/meta/pet.js';

const TIERS = new Set(['白', '青', '金', '墨玉']);

test('petLevel：精通題數再高也不超過 MAX_LEVEL', () => {
  const meta = { collection: {} };
  for (let i = 0; i < 999; i++) {
    meta.collection[`zy-${i}`] = { earnedAt: 1 };
  }
  const baize = PETS.find((p) => p.id === 'baize');
  assert.equal(petLevel(meta, baize), MAX_LEVEL);
});

test('petLevel：精通題數為 0 時等級為 0', () => {
  const meta = { collection: {} };
  const baize = PETS.find((p) => p.id === 'baize');
  assert.equal(petLevel(meta, baize), 0);
});

test('PET_EQUIP：每件裝備皆有合法的 tier 標籤', () => {
  for (const e of PET_EQUIP) {
    assert.ok(TIERS.has(e.tier), `${e.id} 的 tier「${e.tier}」不在合法列表中`);
  }
});

test('高段設備擴充：四件新設備 schema 合法且花費遞增', () => {
  const ids = ['panhu', 'bifang', 'taowu', 'zhuyin'];
  const byId = new Map(PET_EQUIP.map((e) => [e.id, e]));
  let prevPrice = 0;
  for (const id of ids) {
    const e = byId.get(id);
    assert.ok(e, `缺少新設備 ${id}`);
    assert.ok(e.price > prevPrice, `${id} 價格應高於前一件`);
    prevPrice = e.price;
    assert.equal(e.upgradeCost.length, 2);
    assert.equal(e.upgradeGate.length, 2);
    const hasEffect = (e.effect.damageBonus || 0) > 0 || (e.effect.freeEliminate || 0) > 0;
    assert.ok(hasEffect, `${id} 應至少有一種戰鬥效果`);
  }
});
