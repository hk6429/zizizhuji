// 家長設定：每日練習題數上限（裝置層級設定，不進 zzj_meta）。
// zizhu:dailyLimit 存正整數字串；'0' 或空字串／缺值＝不限制。
// bypassLimitOnce 是 session 內（記憶體）的軟性解除，重整頁面就恢復限制。

const DAILY_LIMIT_KEY = 'zizhu:dailyLimit';
const DAILY_PIN_KEY = 'zizhu:dailyPin';

let bypassed = false;

// 家長通行碼（選用）：設了之後，孩子要「再練一下下」得先輸入正確碼。
// 空字串／未設＝不啟用，維持原本軟性提醒。存裝置端，不進雲端存檔。
export function getDailyPin() {
  try { return (localStorage.getItem(DAILY_PIN_KEY) || '').trim(); } catch { return ''; }
}

export function setDailyPin(pin) {
  try {
    const v = String(pin ?? '').trim();
    if (v) localStorage.setItem(DAILY_PIN_KEY, v);
    else localStorage.removeItem(DAILY_PIN_KEY);
  } catch { /* 隱私模式下不啟用 */ }
}

export function hasDailyPin() {
  return getDailyPin().length > 0;
}

export function checkDailyPin(input) {
  const pin = getDailyPin();
  if (!pin) return true; // 沒設碼＝不擋
  return String(input ?? '').trim() === pin;
}

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
