// 每日任務：三條主線（勤學／對弈／不輟），每條各拆易／中／難三階，共 9 個獨立獎勵，隔日自動重置。
// 進度全部讀 meta.daily 既有計數（rolloverDaily 每日歸零），不新增追蹤面：
//   勤學＝今日答對題數(todayCorrect)、對弈＝今日完成對戰場次(todayBattles)、不輟＝今日作答總題數(todayAnswered)。
// 三階門檻遞增、獎勵遞增；達成任一階即可各自領取。獎勵走 earnPearls 的 'daily-quest'（不受每日上限）。
import { earnPearls } from './economy.js';
import { rolloverDaily } from './daily.js';

// 三條主線的定義：group=主線名、metric=計數面、每階 [門檻, 獎勵]。
export const QUEST_LINES = [
  { key: 'diligent', name: '勤學', metric: 'todayCorrect',  unit: '答對', tiers: [['易', 5, 10], ['中', 15, 22], ['難', 30, 40]] },
  { key: 'duel',     name: '對弈', metric: 'todayBattles',  unit: '對戰', tiers: [['易', 1, 15], ['中', 3, 32], ['難', 5, 55]] },
  { key: 'endure',   name: '不輟', metric: 'todayAnswered', unit: '作答', tiers: [['易', 20, 12], ['中', 50, 28], ['難', 100, 50]] },
];

// 攤平成 9 個任務，id = `${key}-${易/中/難}`。
export const DAILY_QUESTS = QUEST_LINES.flatMap((line) =>
  line.tiers.map(([tier, goal, reward]) => ({
    id: `${line.key}-${tier}`,
    line: line.key, name: line.name, tier, metric: line.metric, unit: line.unit,
    desc: `今日${line.unit} ${goal} 題`,
    goal, reward,
  })),
);

function metricValue(meta, metric) { return meta.daily?.[metric] || 0; }

// 回傳 9 個任務的即時狀態（含所屬主線／進度／是否達標／是否已領）。today 傳入時順帶跨日重置（同 getLanternState 慣例）。
export function getQuests(meta, today) {
  if (today) rolloverDaily(meta, today);
  const claimed = meta.daily.questsClaimed || [];
  return DAILY_QUESTS.map((q) => {
    const value = metricValue(meta, q.metric);
    return {
      id: q.id, line: q.line, name: q.name, tier: q.tier, unit: q.unit, desc: q.desc,
      metric: q.metric, value, goal: q.goal, reward: q.reward,
      progress: Math.min(value, q.goal),
      done: value >= q.goal,
      claimed: claimed.includes(q.id),
    };
  });
}

// 依主線分組回傳，供首頁面板以「一線三階」呈現。
export function getQuestLines(meta, today) {
  const all = getQuests(meta, today);
  return QUEST_LINES.map((line) => ({
    key: line.key, name: line.name, unit: line.unit, metric: line.metric,
    value: metricValue(meta, line.metric),
    tiers: all.filter((q) => q.line === line.key),
  }));
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
