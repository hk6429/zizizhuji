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
