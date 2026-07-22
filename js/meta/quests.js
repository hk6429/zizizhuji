// 每日任務：三種不同類型的任務，分簡單／中等／困難，各給一次性字珠獎勵，隔日自動重置。
// 進度全部讀 meta.daily 既有計數（rolloverDaily 每日歸零），不新增追蹤面：
//   簡單・勤學＝今日答對題數(todayCorrect)、中等・對弈＝今日完成對戰場次(todayBattles)、
//   困難・不輟＝今日作答總題數(todayAnswered)。獎勵走 earnPearls 的 'daily-quest'（不受每日上限）。
import { earnPearls } from './economy.js';
import { rolloverDaily } from './daily.js';

export const DAILY_QUESTS = [
  { id: 'diligent', tier: '簡單', name: '勤學', desc: '今日答對 10 題',   metric: 'todayCorrect',  goal: 10, reward: 15 },
  { id: 'duel',     tier: '中等', name: '對弈', desc: '今日完成 1 場對戰', metric: 'todayBattles',  goal: 1,  reward: 35 },
  { id: 'endure',   tier: '困難', name: '不輟', desc: '今日作答 40 題',   metric: 'todayAnswered', goal: 40, reward: 70 },
];

function metricValue(meta, metric) { return meta.daily?.[metric] || 0; }

// 回傳三個任務的即時狀態（含進度／是否達標／是否已領）。today 傳入時順帶跨日重置（同 getLanternState 慣例）。
export function getQuests(meta, today) {
  if (today) rolloverDaily(meta, today);
  const claimed = meta.daily.questsClaimed || [];
  return DAILY_QUESTS.map((q) => {
    const value = metricValue(meta, q.metric);
    return {
      id: q.id, tier: q.tier, name: q.name, desc: q.desc, goal: q.goal, reward: q.reward,
      progress: Math.min(value, q.goal),
      done: value >= q.goal,
      claimed: claimed.includes(q.id),
    };
  });
}

// 領取任務獎勵：需達標且未領過。成功回傳 { ok:true, reward }；否則 { ok:false, reason }。
export function claimQuest(meta, id, today) {
  if (today) rolloverDaily(meta, today);
  const q = DAILY_QUESTS.find((x) => x.id === id);
  if (!q) return { ok: false, reason: 'not-found' };
  const claimed = meta.daily.questsClaimed || (meta.daily.questsClaimed = []);
  if (claimed.includes(id)) return { ok: false, reason: 'claimed' };
  if (metricValue(meta, q.metric) < q.goal) return { ok: false, reason: 'unmet' };
  const { earned } = earnPearls(meta, q.reward, 'daily-quest', today);
  claimed.push(id);
  return { ok: true, reward: earned };
}

// 尚可領取的任務數（達標且未領），供首頁入口紅點提示。
export function claimableCount(meta, today) {
  return getQuests(meta, today).filter((q) => q.done && !q.claimed).length;
}
