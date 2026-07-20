// 神獸融合系統邏輯層：墨晶貨幣／融合資格／融合核心／稱號被動／配方揭曉／稚靈出戰與名片。
// 純函式操作 meta（zzj_meta 的 meta.fusion），不碰 DOM、不呼叫 saveMeta——存檔由呼叫端負責。
// 敘事定位：融合＝修復被濁墨吞噬的神獸血脈（接 js/meta/bond.js 的濁墨世界觀）。
// 硬性規則（vocab-duel P3-11 教訓）：雙親永不消耗；失敗只扣墨晶（白帽時間成本，不扣資產）。

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
