import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  createBattleGuards, guardCombo, guardHp, grantStreakCharm, consumeStreakCharm,
} from '../../js/meta/charms.js';

test('guardCombo halves a 5+ combo once per battle', () => {
  let guards = createBattleGuards();
  let r = guardCombo(7, guards);
  assert.equal(r.combo, 3); // floor(7/2)
  assert.equal(r.triggered, true);
  guards = r.guards;
  r = guardCombo(6, guards); // 第二次不再保護
  assert.equal(r.combo, 0);
  assert.equal(r.triggered, false);
});

test('guardCombo does not trigger below 5 combo', () => {
  const r = guardCombo(4, createBattleGuards());
  assert.equal(r.combo, 0);
  assert.equal(r.triggered, false);
  assert.equal(r.guards.comboUsed, false); // 保護留著
});

test('guardHp floors hp at 10 once, then lets it fall', () => {
  let guards = createBattleGuards();
  let r = guardHp(-5, guards);
  assert.equal(r.hp, 10);
  assert.equal(r.triggered, true);
  guards = r.guards;
  r = guardHp(3, guards);
  assert.equal(r.hp, 3);
  assert.equal(r.triggered, false);
});

test('guardHp does not touch hp at or above 10', () => {
  const r = guardHp(10, createBattleGuards());
  assert.equal(r.hp, 10);
  assert.equal(r.triggered, false);
  assert.equal(r.guards.hpUsed, false);
});

test('streak charms: grant caps at 2, consume decrements and fails at 0', () => {
  const meta = defaultMeta();
  grantStreakCharm(meta);
  grantStreakCharm(meta);
  grantStreakCharm(meta);
  assert.equal(meta.daily.charms, 2);
  assert.equal(consumeStreakCharm(meta).ok, true);
  assert.equal(consumeStreakCharm(meta).ok, true);
  assert.equal(consumeStreakCharm(meta).ok, false);
});
