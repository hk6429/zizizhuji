// 即時對戰賽季制排位 — 月賽季（YYYY-MM 一到月初自動換季）＋六階稱號。
// 白帽：輸也加分（不倒扣），只是加得比贏少；稱號限賽季內取得，稀缺性隨月份重算。
// 全包 try/catch 比照 js/meta/store.js，隱私模式存取 localStorage 不炸。
//
// 2026-07 張力校準：純看總分會讓稱號變成「時間堆出來的」——每天無腦打幾場、
// 輸也穩加分，分數只會單調上升。加兩道實力線：
// 1) 高三階稱號額外要求勝率門檻（minWinRate），逼真正打贏才能拿高階稱號。
// 2) 安慰分（LOSE_PTS）改為「有條件」：本場答對率低於門檻才打折，
//    不懲罰認真作答但打輸的孩子，只擋純掛機／亂點刷分。

const LS_KEY = 'zz_rt_season';
const BEST_KEY = 'zz_rt_solo_best'; // 單人挑戰「今日墨靈刺客」歷史最佳輸出

export const SEASON_TITLES = [
  { min: 0, title: '白衣書生' },
  { min: 60, title: '青衿學子' },
  { min: 160, title: '墨林秀才' },
  { min: 320, title: '珠璣舉人', minWinRate: 0.3 },
  { min: 560, title: '翰墨進士', minWinRate: 0.4 },
  { min: 880, title: '文曲魁星', minWinRate: 0.5 },
];

export const WIN_PTS = 20;
export const LOSE_PTS = 5; // 輸也加分（白帽：不倒扣）
// 四選一亂猜的期望答對率約 25%；門檻取略高的 30%，
// 讓「認真作答但答錯較多」的孩子仍拿滿額安慰分，只擋掉近乎沒作答的純掛機／亂點。
export const LOSE_ACCURACY_THRESHOLD = 0.3;
export const LOSE_PTS_MIN = 1; // 未達門檻仍給 1 分（不倒扣底線不變），但明顯低於正常安慰分

export function seasonKey(dateStr) {
  return String(dateStr).slice(0, 7);
}

// wins/battles 用來算勝率；只給 pts 時等同勝率 0（沿用舊呼叫方式仍可運作，但拿不到高階稱號）。
export function titleFor(pts, wins = 0, battles = 0) {
  const winRate = battles > 0 ? wins / battles : 0;
  let title = SEASON_TITLES[0].title;
  for (const t of SEASON_TITLES) {
    if (pts >= t.min && (t.minWinRate == null || winRate >= t.minWinRate)) title = t.title;
  }
  return title;
}

function defaultSeason(key) {
  return { key, pts: 0, wins: 0, battles: 0 };
}

export function loadSeason(today) {
  const key = seasonKey(today);
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultSeason(key);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || parsed.key !== key) return defaultSeason(key);
    return {
      key,
      pts: Number(parsed.pts) || 0,
      wins: Number(parsed.wins) || 0,
      battles: Number(parsed.battles) || 0,
    };
  } catch {
    return defaultSeason(key);
  }
}

function saveSeason(s) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch { /* 隱私模式寫入可能 throw，忽略即可 */ }
}

// correctRate：本場答對率（0~1），用於「安慰分有條件」判定；預設 1（未提供時視同全對，不打折，向下相容舊呼叫）。
export function recordResult(today, verdict, correctRate = 1) {
  const s = loadSeason(today);
  const gain = verdict === 'win'
    ? WIN_PTS
    : (correctRate < LOSE_ACCURACY_THRESHOLD ? LOSE_PTS_MIN : LOSE_PTS);
  s.pts += gain;
  s.battles += 1;
  if (verdict === 'win') s.wins += 1;
  saveSeason(s);
  return { ...s, title: titleFor(s.pts, s.wins, s.battles) };
}

// ---------- 單人挑戰「今日墨靈刺客」歷史最佳輸出（純本機紀錄，非賽季分數） ----------

export function loadSoloBest() {
  try {
    const n = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// 回傳 { best, isNew }：isNew 表示這次輸出刷新了歷史紀錄。
export function saveSoloBestIfHigher(dmg) {
  const best = loadSoloBest();
  if (dmg <= best) return { best, isNew: false };
  try {
    localStorage.setItem(BEST_KEY, String(dmg));
  } catch { /* 隱私模式寫入可能 throw，忽略即可 */ }
  return { best: dmg, isNew: true };
}
