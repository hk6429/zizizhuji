import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  categoryWeakTypes, categoryAccuracy, getEligibility, canFusePair,
  ACCURACY_GATE, ACCURACY_MIN_SAMPLE,
} from '../js/meta/fusion-store.js';
import { LEVEL_STEP, MAX_LEVEL } from '../js/meta/pet.js';

// 造出「某類別兩隻滿級」的 meta：塞滿 MAX_LEVEL*LEVEL_STEP 顆已煉成字珠（zy- 前綴＝字音）。
function maxedZiyinMeta() {
  const collection = {};
  for (let i = 0; i < MAX_LEVEL * LEVEL_STEP; i++) {
    collection[`zy-${i}`] = { earnedAt: '2026-07-01', wrong: 0 };
  }
  return { collection, weak: { 字音: { correct: 90, wrong: 10 }, 字形: { correct: 45, wrong: 5 } } };
}

test('categoryWeakTypes：三類別對照正確', () => {
  assert.deepEqual(categoryWeakTypes('字音'), ['字音', '字形']);
  assert.deepEqual(categoryWeakTypes('成語'), ['意義', '近似成語', '錯別字']);
  assert.deepEqual(categoryWeakTypes('混合'), ['字音', '字形', '意義', '近似成語', '錯別字']);
});

test('categoryAccuracy：彙總類別對應弱點分類的正確率', () => {
  const meta = maxedZiyinMeta();
  const r = categoryAccuracy(meta, '字音'); // (90+45)/(100+50) = 0.9
  assert.equal(r.total, 150);
  assert.ok(Math.abs(r.accuracy - 0.9) < 1e-9);
});

test('getEligibility：兩隻滿級＋正確率達標 → eligible', () => {
  const meta = maxedZiyinMeta();
  const r = getEligibility(meta, '字音');
  assert.equal(r.eligible, true);
  assert.ok(r.maxLevelPets.length >= 2); // 字音 4 隻精通同源，滿級一起滿
  assert.deepEqual(r.reasons, { pair: true, accuracy: true });
});

test('getEligibility：正確率未達 80% → 不合格且 reasons.accuracy=false', () => {
  const meta = maxedZiyinMeta();
  meta.weak = { 字音: { correct: 10, wrong: 10 } }; // 50%
  const r = getEligibility(meta, '字音');
  assert.equal(r.eligible, false);
  assert.equal(r.reasons.accuracy, false);
  assert.equal(r.reasons.pair, true);
});

test('getEligibility：樣本數不足 ACCURACY_MIN_SAMPLE 視同未達標', () => {
  const meta = maxedZiyinMeta();
  meta.weak = { 字音: { correct: ACCURACY_MIN_SAMPLE - 1, wrong: 0 } }; // 100% 但樣本不足
  assert.equal(getEligibility(meta, '字音').eligible, false);
});

test('getEligibility：未滿級 → reasons.pair=false', () => {
  const meta = { collection: {}, weak: { 字音: { correct: 100, wrong: 0 } } };
  const r = getEligibility(meta, '字音');
  assert.equal(r.eligible, false);
  assert.equal(r.reasons.pair, false);
});

test('canFusePair：擋同一隻、跨類別、不存在的 id', () => {
  const meta = maxedZiyinMeta();
  assert.equal(canFusePair(meta, 'baize', 'baize').reason, 'same-pet');
  assert.equal(canFusePair(meta, 'baize', 'fenghuang').reason, 'category-mismatch');
  assert.equal(canFusePair(meta, 'baize', 'nobody').reason, 'not-found');
  assert.equal(canFusePair(meta, 'baize', 'kui').ok, true);
});

test('canFusePair：正確率不足時回 accuracy', () => {
  const meta = maxedZiyinMeta();
  meta.weak = {};
  assert.equal(canFusePair(meta, 'baize', 'kui').reason, 'accuracy');
});
