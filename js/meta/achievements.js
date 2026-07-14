// M11 成就冊：成就定義（含隱藏成就）、純函式判定、解鎖記錄與累計統計。
// checkAchievements(stats) 為純函式，回傳「條件已達成」的成就 id 清單；unlock 負責過濾已解鎖。

export const ACHIEVEMENTS = [
  { id: 'first-win', name: '初戰告捷', desc: '贏得第一場對戰', pearls: 10, hidden: false },
  { id: 'combo-3', name: '三連珠', desc: '單場連對 3 題', pearls: 5, hidden: false },
  { id: 'combo-5', name: '五連珠', desc: '單場連對 5 題', pearls: 10, hidden: false },
  { id: 'combo-10', name: '十連珠', desc: '單場連對 10 題', pearls: 30, hidden: true, title: '文曲星降臨' },
  { id: 'perfect', name: '零失手', desc: '一場對戰全對獲勝', pearls: 15, hidden: false },
  { id: 'answered-100', name: '百題書生', desc: '累計答對 100 題', pearls: 15, hidden: false },
  { id: 'answered-1000', name: '千錘百煉', desc: '累計答對 1000 題', pearls: 50, hidden: false },
  { id: 'moling-bane', name: '墨靈剋星', desc: '對戰勝利 10 場', pearls: 20, hidden: false },
  { id: 'lantern-3', name: '守燈三日', desc: '連續守燈 3 天', pearls: 5, hidden: false },
  { id: 'lantern-7', name: '守燈七日', desc: '連續守燈 7 天', pearls: 10, hidden: false },
  { id: 'lantern-30', name: '守燈三十日', desc: '連續守燈 30 天', pearls: 30, hidden: false },
];

const CONDITIONS = {
  'first-win': s => s.wins >= 1,
  'combo-3': s => s.bestCombo >= 3,
  'combo-5': s => s.bestCombo >= 5,
  'combo-10': s => s.bestCombo >= 10,
  'perfect': s => s.perfectGames >= 1,
  'answered-100': s => s.totalCorrect >= 100,
  'answered-1000': s => s.totalCorrect >= 1000,
  'moling-bane': s => s.wins >= 10,
  'lantern-3': s => s.lanternBest >= 3,
  'lantern-7': s => s.lanternBest >= 7,
  'lantern-30': s => s.lanternBest >= 30,
};

// 累計統計：計數欄位相加，bestCombo / lanternBest 取最大值。
const ADDITIVE = new Set(['wins', 'battles', 'perfectGames', 'totalAnswered', 'totalCorrect']);
const MAXIMAL = new Set(['bestCombo', 'lanternBest']);

export function recordStats(meta, patch) {
  const stats = meta.ach.stats;
  for (const [key, value] of Object.entries(patch)) {
    if (!Number.isFinite(value)) continue;
    if (ADDITIVE.has(key)) stats[key] = (stats[key] || 0) + value;
    else if (MAXIMAL.has(key)) stats[key] = Math.max(stats[key] || 0, value);
    else stats[key] = value;
  }
  return meta;
}

export function checkAchievements(stats) {
  return ACHIEVEMENTS.filter(a => CONDITIONS[a.id](stats)).map(a => a.id);
}

export function unlock(meta, ids) {
  const newlyUnlocked = [];
  for (const id of ids) {
    if (meta.ach.unlocked[id]) continue;
    const def = ACHIEVEMENTS.find(a => a.id === id);
    if (!def) continue;
    meta.ach.unlocked[id] = new Date().toISOString();
    newlyUnlocked.push(def);
  }
  return { meta, newlyUnlocked };
}
