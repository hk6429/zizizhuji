// 字珠單一貨幣收支入口。所有加珠/扣珠一律經過這裡，防重複記帳。
// 每日獲取上限 120 珠；一次性獎勵（成就/守燈里程碑/羈絆贈禮）不計入上限。

export const DAILY_EARN_CAP = 120;

// 不受每日上限限制的收入來源（一次性獎勵）
export const CAP_EXEMPT_REASONS = new Set([
  'achievement',        // 成就冊
  'lantern-milestone',  // 守燈里程碑
  'bond-gift',          // 羈絆贈禮
  'fusion-consolation', // 融合失敗安慰（少量、非 farm 得動的來源）
]);

export function earnPearls(meta, amount, reason = '', today = '') {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { meta, earned: 0, capped: false };
  }
  const p = meta.pearls;
  if (today && p.earnedDate !== today) {
    p.earnedDate = today;
    p.earnedToday = 0;
  }
  let earned = Math.floor(amount);
  let capped = false;
  if (!CAP_EXEMPT_REASONS.has(reason)) {
    const room = Math.max(0, DAILY_EARN_CAP - p.earnedToday);
    if (earned > room) {
      earned = room;
      capped = true;
    }
    p.earnedToday += earned;
  }
  p.balance += earned;
  return { meta, earned, capped };
}

export function spendPearls(meta, amount, reason = '') {
  if (!Number.isFinite(amount) || amount < 0) return { meta, ok: false };
  if (meta.pearls.balance < amount) return { meta, ok: false };
  meta.pearls.balance -= amount;
  return { meta, ok: true };
}

export function getBalance(meta) {
  return meta.pearls.balance;
}
