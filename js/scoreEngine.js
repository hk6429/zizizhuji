// M2 積分競技核心：升級(功能一 base)×加倍(功能二 combo)、逐步升等、保險減扣分。
// 純函式、無副作用、可測。字珠收支經呼叫端傳入的 spendPearls，本檔不碰持久化。

// 逐步升等階梯：達門檻分數可按鈕升等，基礎分隨階提升（＝功能一「升級」）。
export const TIERS = [
  { at: 0,       base: 1,  name: '蒙生' },
  { at: 1000,    base: 2,  name: '學徒' },
  { at: 10000,   base: 5,  name: '高手' },
  { at: 100000,  base: 10, name: '宗師' },
  { at: 1000000, base: 20, name: '文曲星' },
];

export const PENALTY_RATE = 0.05;        // 答錯扣「當前分數」的 5%（分數越高扣越多）
export const INSURANCE_REDUCTION = 0.7;  // 買保險後扣分減 70%
export const INSURANCE_COST = 20;        // 保險售價（字珠）
export const MAX_COMBO_MULT = 10;

// 加倍（功能二）：連對越長倍率越高，街機式爽感，封頂 ×10。
export function comboMultiplier(streak) {
  if (streak >= 10) return MAX_COMBO_MULT;
  if (streak >= 7) return 5;
  if (streak >= 5) return 3;
  if (streak >= 3) return 2;
  return 1;
}

export function createScoreState() {
  return { score: 0, streak: 0, tier: 0, best: 0, insured: false, answered: 0, correct: 0 };
}

// 預覽「答對這一題會拿幾分」（連對＋1 後的倍率）。UI 用來提示。
export function previewGain(state) {
  return TIERS[state.tier].base * comboMultiplier(state.streak + 1);
}

export function answer(state, correct) {
  const s = { ...state, answered: state.answered + 1 };
  if (correct) {
    s.streak = state.streak + 1;
    const gain = TIERS[state.tier].base * comboMultiplier(s.streak);
    s.score = state.score + gain;
    s.correct = state.correct + 1;
    s.best = Math.max(state.best, s.score);
    return { state: s, gain, penalty: 0 };
  }
  s.streak = 0;
  let penalty = Math.ceil(state.score * PENALTY_RATE);
  if (state.insured) penalty = Math.round(penalty * (1 - INSURANCE_REDUCTION));
  s.score = Math.max(0, state.score - penalty);
  return { state: s, gain: 0, penalty };
}

export function canPromote(state) {
  const next = state.tier + 1;
  return next < TIERS.length && state.score >= TIERS[next].at;
}

export function promote(state) {
  if (!canPromote(state)) return { state, promoted: false };
  const tier = state.tier + 1;
  return { state: { ...state, tier }, promoted: true, name: TIERS[tier].name };
}

// 買保險：花 INSURANCE_COST 字珠，整場有效。spendPearls 由呼叫端注入（js/meta/economy）。
export function buyInsurance(meta, state, spendPearls) {
  if (state.insured) return { state, ok: false, reason: 'already' };
  const r = spendPearls(meta, INSURANCE_COST, 'score-insurance');
  if (!r.ok) return { state, ok: false, reason: 'poor' };
  return { state: { ...state, insured: true }, ok: true };
}
