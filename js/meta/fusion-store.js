// 神獸融合系統邏輯層：墨晶貨幣／融合資格／融合核心／稱號被動／配方揭曉／稚靈出戰與名片。
// 純函式操作 meta（zzj_meta 的 meta.fusion），不碰 DOM、不呼叫 saveMeta——存檔由呼叫端負責。
// 敘事定位：融合＝修復被濁墨吞噬的神獸血脈（接 js/meta/bond.js 的濁墨世界觀）。
// 硬性規則（vocab-duel P3-11 教訓）：雙親永不消耗；失敗只扣墨晶（白帽時間成本，不扣資產）。

import { PETS, petLevel, MAX_LEVEL } from './pet.js';

export const CRYSTAL_DAILY_CAP = 10; // 墨晶每日取得上限

export function ensureFusionState(meta) {
  if (!meta.fusion) {
    meta.fusion = {
      crystals: { balance: 0, earnedToday: 0, earnedDate: '' },
      cubs: {}, revealed: {}, riddleTried: {}, activeCub: null,
    };
  }
  const s = meta.fusion;
  if (!s.crystals) s.crystals = { balance: 0, earnedToday: 0, earnedDate: '' };
  if (!s.cubs) s.cubs = {};
  if (!s.revealed) s.revealed = {};
  if (!s.riddleTried) s.riddleTried = {};
  if (s.activeCub === undefined) s.activeCub = null;
  return s;
}

// 墨晶入帳：仿 economy.js earnPearls 的每日上限邏輯，但墨晶無豁免來源。
export function earnCrystals(meta, amount, today = '') {
  const s = ensureFusionState(meta);
  if (!Number.isFinite(amount) || amount <= 0) return { meta, earned: 0, capped: false };
  const c = s.crystals;
  if (today && c.earnedDate !== today) {
    c.earnedDate = today;
    c.earnedToday = 0;
  }
  let earned = Math.floor(amount);
  let capped = false;
  const room = Math.max(0, CRYSTAL_DAILY_CAP - c.earnedToday);
  if (earned > room) { earned = room; capped = true; }
  c.earnedToday += earned;
  c.balance += earned;
  return { meta, earned, capped };
}

export function spendCrystals(meta, amount) {
  const s = ensureFusionState(meta);
  if (!Number.isFinite(amount) || amount < 0) return { meta, ok: false };
  if (s.crystals.balance < amount) return { meta, ok: false };
  s.crystals.balance -= amount;
  return { meta, ok: true };
}

export function getCrystalBalance(meta) {
  return ensureFusionState(meta).crystals.balance;
}

// —— 融合資格判定：同類別雙親皆滿級（Lv15）＋類別正確率達門檻 ——

export const ACCURACY_GATE = 0.8;      // 類別近期正確率門檻
export const ACCURACY_MIN_SAMPLE = 20; // 樣本數不足不放行，避免 3 題 100% 就過關

const PET_BY_ID = new Map(PETS.map((p) => [p.id, p]));

// 類別 → weakness.js 弱點分類（與 pet-ui.js petCategoryTypes 同邏輯；那邊是私有函式，這裡自持一份）
export function categoryWeakTypes(category) {
  if (category === '字音') return ['字音', '字形'];
  if (category === '成語') return ['意義', '近似成語', '錯別字'];
  return ['字音', '字形', '意義', '近似成語', '錯別字'];
}

// 以 meta.weak 累計紀錄近似「近期正確率」：彙總該類別對應弱點分類的 correct/wrong。
export function categoryAccuracy(meta, category) {
  const weak = (meta && meta.weak) || {};
  let correct = 0, total = 0;
  for (const type of categoryWeakTypes(category)) {
    const w = weak[type];
    if (!w) continue;
    correct += w.correct;
    total += w.correct + w.wrong;
  }
  return { accuracy: total > 0 ? correct / total : 0, total };
}

export function getEligibility(meta, category) {
  const maxLevelPets = PETS
    .filter((p) => p.category === category && petLevel(meta, p) >= MAX_LEVEL)
    .map((p) => p.id);
  const { accuracy, total } = categoryAccuracy(meta, category);
  const reasons = {
    pair: maxLevelPets.length >= 2,
    accuracy: total >= ACCURACY_MIN_SAMPLE && accuracy >= ACCURACY_GATE,
  };
  return { eligible: reasons.pair && reasons.accuracy, maxLevelPets, accuracy, total, reasons };
}

export function canFusePair(meta, petIdA, petIdB) {
  if (petIdA === petIdB) return { ok: false, reason: 'same-pet' };
  const a = PET_BY_ID.get(petIdA);
  const b = PET_BY_ID.get(petIdB);
  if (!a || !b) return { ok: false, reason: 'not-found' };
  if (a.category !== b.category) return { ok: false, reason: 'category-mismatch' };
  if (petLevel(meta, a) < MAX_LEVEL || petLevel(meta, b) < MAX_LEVEL) return { ok: false, reason: 'level' };
  const e = getEligibility(meta, a.category);
  if (!e.reasons.accuracy) return { ok: false, reason: 'accuracy' };
  return { ok: true, reason: null };
}
