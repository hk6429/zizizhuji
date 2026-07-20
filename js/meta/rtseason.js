// 即時對戰賽季制排位 — 月賽季（YYYY-MM 一到月初自動換季）＋六階稱號。
// 白帽：輸也加分（不倒扣），只是加得比贏少；稱號限賽季內取得，稀缺性隨月份重算。
// 全包 try/catch 比照 js/meta/store.js，隱私模式存取 localStorage 不炸。

const LS_KEY = 'zz_rt_season';

export const SEASON_TITLES = [
  { min: 0, title: '白衣書生' },
  { min: 60, title: '青衿學子' },
  { min: 160, title: '墨林秀才' },
  { min: 320, title: '珠璣舉人' },
  { min: 560, title: '翰墨進士' },
  { min: 880, title: '文曲魁星' },
];

export const WIN_PTS = 20;
export const LOSE_PTS = 5; // 輸也加分（白帽：不倒扣）

export function seasonKey(dateStr) {
  return String(dateStr).slice(0, 7);
}

export function titleFor(pts) {
  let title = SEASON_TITLES[0].title;
  for (const t of SEASON_TITLES) {
    if (pts >= t.min) title = t.title;
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

export function recordResult(today, verdict) {
  const s = loadSeason(today);
  s.pts += verdict === 'win' ? WIN_PTS : LOSE_PTS;
  s.battles += 1;
  if (verdict === 'win') s.wins += 1;
  saveSeason(s);
  return { ...s, title: titleFor(s.pts) };
}
