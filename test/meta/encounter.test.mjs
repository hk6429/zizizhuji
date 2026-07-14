import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  BATTLE_EVENTS, PRACTICE_EVENTS, PITY_THRESHOLD, rollEncounter,
} from '../../js/meta/encounter.js';

function seq(...values) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('event tables carry the designed weights (30/25/20/15/10) and same ids', () => {
  assert.deepEqual(BATTLE_EVENTS.map(e => e.weight), [30, 25, 20, 15, 10]);
  assert.deepEqual(BATTLE_EVENTS.map(e => e.id), PRACTICE_EVENTS.map(e => e.id));
});

test('no trigger when roll is above rate; sinceLast accumulates', () => {
  const meta = defaultMeta();
  const r = rollEncounter(meta, 'battle', seq(0.5));
  assert.equal(r.event, null);
  assert.equal(meta.encounter.sinceLast, 1);
});

test('trigger when roll is under 8%; weighted pick is rng-deterministic', () => {
  const meta = defaultMeta();
  // 第一個 rng 值 0.01 → 觸發；第二個 0 → 權重表第一格（文曲星）
  const r = rollEncounter(meta, 'battle', seq(0.01, 0));
  assert.equal(r.event.id, 'wenqu');
  assert.equal(meta.encounter.sinceLast, 0);
  assert.equal(meta.encounter.totalCount, 1);
});

test('pity: after 12 misses the 13th question always triggers', () => {
  const meta = defaultMeta();
  for (let i = 0; i < PITY_THRESHOLD; i++) {
    assert.equal(rollEncounter(meta, 'battle', seq(0.99)).event, null);
  }
  const r = rollEncounter(meta, 'battle', seq(0.99, 0.99)); // rng 再高也必觸發
  assert.ok(r.event);
});

test('the same event never repeats twice in a row', () => {
  const meta = defaultMeta();
  const first = rollEncounter(meta, 'battle', seq(0.01, 0)); // wenqu
  assert.equal(first.event.id, 'wenqu');
  // rng 0 又會挑池子第一格；wenqu 已被排除 → moling
  const second = rollEncounter(meta, 'battle', seq(0.01, 0));
  assert.equal(second.event.id, 'moling');
});

test('custom rate option (靈感日 15%) widens the trigger window', () => {
  const meta = defaultMeta();
  const missAt8 = rollEncounter(meta, 'battle', seq(0.1), {});
  assert.equal(missAt8.event, null);
  const hitAt15 = rollEncounter(meta, 'battle', seq(0.1, 0), { rate: 0.15 });
  assert.ok(hitAt15.event);
});

test('practice table swaps battle effects for pearl/hint effects', () => {
  const meta = defaultMeta();
  const r = rollEncounter(meta, 'practice', seq(0.01, 0));
  assert.equal(r.event.effect.type, 'doublePearls');
});
