import { test } from 'node:test';
import assert from 'node:assert';
import {
  createScoreState, answer, comboMultiplier, previewGain,
  canPromote, promote, buyInsurance, TIERS, PENALTY_RATE, INSURANCE_COST,
} from '../js/scoreEngine.js';

test('初始狀態全零、tier 0', () => {
  const s = createScoreState();
  assert.deepEqual(
    { score: s.score, streak: s.streak, tier: s.tier, insured: s.insured },
    { score: 0, streak: 0, tier: 0, insured: false },
  );
});

test('答對得基礎分，連對推倍率（功能二 加倍）', () => {
  let s = createScoreState();
  // 前兩題 ×1（base 1）
  ({ state: s } = answer(s, true)); // streak1 → 1
  ({ state: s } = answer(s, true)); // streak2 → 1
  assert.equal(s.score, 2);
  // 第三題 streak3 → ×2
  const r = answer(s, true);
  assert.equal(r.gain, 2);
  assert.equal(comboMultiplier(3), 2);
});

test('倍率曲線封頂 ×10', () => {
  assert.equal(comboMultiplier(1), 1);
  assert.equal(comboMultiplier(5), 3);
  assert.equal(comboMultiplier(7), 5);
  assert.equal(comboMultiplier(10), 10);
  assert.equal(comboMultiplier(50), 10);
});

test('previewGain 反映連對＋1 後的倍率', () => {
  let s = createScoreState();
  ({ state: s } = answer(s, true));
  ({ state: s } = answer(s, true)); // streak 2，下一題進 streak 3 → ×2
  assert.equal(previewGain(s), TIERS[0].base * 2);
});

test('答錯扣當前分數 5%、連對歸零', () => {
  let s = createScoreState();
  s = { ...s, score: 1000, streak: 5 };
  const r = answer(s, false);
  assert.equal(r.penalty, Math.ceil(1000 * PENALTY_RATE));
  assert.equal(r.state.score, 1000 - r.penalty);
  assert.equal(r.state.streak, 0);
});

test('分數不會扣成負', () => {
  let s = { ...createScoreState(), score: 3 };
  const r = answer(s, false);
  assert.ok(r.state.score >= 0);
});

test('保險把扣分減 70%', () => {
  const base = { ...createScoreState(), score: 1000 };
  const plain = answer(base, false).penalty;
  const insured = answer({ ...base, insured: true }, false).penalty;
  assert.ok(insured < plain);
  assert.equal(insured, Math.round(plain * 0.3));
});

test('逐步升等：達門檻才能升，升後基礎分變高（功能一 升級）', () => {
  let s = createScoreState();
  assert.equal(canPromote(s), false);
  s = { ...s, score: 1000 };
  assert.equal(canPromote(s), true);
  const r = promote(s);
  assert.equal(r.promoted, true);
  assert.equal(r.state.tier, 1);
  assert.equal(TIERS[1].base, 2); // 答對一題從 1 分變 2 分
});

test('未達門檻 promote 無效', () => {
  const s = { ...createScoreState(), score: 500 };
  assert.equal(promote(s).promoted, false);
});

test('買保險扣字珠、餘額不足則失敗', () => {
  const rich = { pearls: { balance: 100 } };
  const spend = (meta, amt) => {
    if (meta.pearls.balance < amt) return { ok: false };
    meta.pearls.balance -= amt; return { ok: true };
  };
  const s = createScoreState();
  const ok = buyInsurance(rich, s, spend);
  assert.equal(ok.ok, true);
  assert.equal(ok.state.insured, true);
  assert.equal(rich.pearls.balance, 100 - INSURANCE_COST);

  const poor = { pearls: { balance: 5 } };
  const fail = buyInsurance(poor, s, spend);
  assert.equal(fail.ok, false);
  assert.equal(fail.reason, 'poor');
});
