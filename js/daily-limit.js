// 家長設定：每日練習題數上限（裝置層級設定，不進 zzj_meta）。
// zizhu:dailyLimit 存正整數字串；'0' 或空字串／缺值＝不限制。
// bypassLimitOnce 是 session 內（記憶體）的軟性解除，重整頁面就恢復限制。

const DAILY_LIMIT_KEY = 'zizhu:dailyLimit';

let bypassed = false;

export function getDailyLimit() {
  try {
    const raw = localStorage.getItem(DAILY_LIMIT_KEY);
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch { return 0; }
}

export function setDailyLimit(n) {
  try {
    const v = Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : '';
    localStorage.setItem(DAILY_LIMIT_KEY, v);
  } catch { /* 隱私模式下僅本次生效，不擋題 */ }
}

export function bypassLimitOnce() {
  bypassed = true;
}

export function isDailyLimitReached(meta) {
  if (bypassed) return false;
  const limit = getDailyLimit();
  if (limit <= 0) return false;
  return (meta?.daily?.todayAnswered || 0) >= limit;
}
