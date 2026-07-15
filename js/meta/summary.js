// M11 戰報結算卡＋分享卡資料＋挑戰碼。
// 挑戰碼 = 'ZZJ1.' + base64url(UTF-8 JSON)，本身即完整資料包，零連線。
// 結算卡為純資料，Canvas 1080×1350 潑墨分享卡由視覺組依此渲染。

import { getBond, pickLine } from './bond.js';
import { getProgress as getRankProgress } from './progress.js';

export const CHALLENGE_PREFIX = 'ZZJ1.';
export const MAX_CHALLENGES = 30;

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function aggregate(sessionEvents) {
  const agg = { pearls: 0, xp: 0, forged: [], polished: [], achievements: [], purifiedCount: 0 };
  for (const e of sessionEvents || []) {
    if (e.type === 'pearlEarned') agg.pearls += e.payload.amount;
    else if (e.type === 'xpGained') agg.xp += e.payload.amount;
    else if (e.type === 'pearlForged') agg.forged.push(e.payload);
    else if (e.type === 'pearlPolished') agg.polished.push(e.payload);
    else if (e.type === 'achievement') agg.achievements.push(e.payload);
    else if (e.type === 'purified') agg.purifiedCount += 1;
  }
  return agg;
}

function baseCard(meta) {
  const bond = getBond(meta);
  return {
    name: meta.profile.name || '無名書生',
    rankName: getRankProgress(meta).rankName,
    lanternStreak: meta.daily.streak,
    bondStage: bond.stageName,
    goldFrame: bond.value >= 100, // 100 羈絆 → 金色潑墨卡框
    seal: null,                   // 'zhuwang' 珠王金印由擂台頁自行蓋上
  };
}

// battleResult = { won, correct, total, bestCombo }
export function buildBattleSummary(battleResult, sessionEvents, meta) {
  const agg = aggregate(sessionEvents);
  const bond = getBond(meta);
  return {
    ...baseCard(meta),
    mode: 'battle',
    won: battleResult.won,
    correct: battleResult.correct,
    total: battleResult.total,
    accuracy: battleResult.total > 0 ? Math.round((battleResult.correct / battleResult.total) * 100) : 0,
    bestCombo: battleResult.bestCombo,
    xpGained: agg.xp,
    pearlsEarned: agg.pearls,
    newPearls: agg.forged,
    newAchievements: agg.achievements,
    purifiedCount: agg.purifiedCount,
    // 墨靈評語：玩家贏 → 她的 win 台詞（認輸）；玩家輸 → lose 台詞（安慰/挑釁）
    molingLine: pickLine(bond.stage, battleResult.won ? 'win' : 'lose'),
  };
}

// sessionStats = { correct, total, bestCombo }
export function buildPracticeSummary(sessionStats, meta) {
  // 練習模式事件已累積在呼叫端 session；此處只需統計欄位
  const bond = getBond(meta);
  return {
    ...baseCard(meta),
    mode: 'practice',
    correct: sessionStats.correct,
    total: sessionStats.total,
    accuracy: sessionStats.total > 0 ? Math.round((sessionStats.correct / sessionStats.total) * 100) : 0,
    bestCombo: sessionStats.bestCombo,
    xpGained: sessionStats.xp ?? 0,
    pearlsEarned: sessionStats.pearls ?? 0,
    molingLine: pickLine(bond.stage, sessionStats.correct >= sessionStats.total * 0.8 ? 'win' : 'lose'),
  };
}

// payload 建議形狀：{ v:1, name, questionIds:[10 題], correct, timeMs, pearls, date }
export function makeChallengeCode(payload) {
  return CHALLENGE_PREFIX + b64urlEncode(JSON.stringify(payload));
}

export function parseChallengeCode(code) {
  if (typeof code !== 'string' || !code.startsWith(CHALLENGE_PREFIX)) return null;
  try {
    const parsed = JSON.parse(b64urlDecode(code.slice(CHALLENGE_PREFIX.length)));
    if (typeof parsed !== 'object' || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

// mine / theirs = { correct, timeMs, pearls }
// 贏了「奪珠成功」：該場獲珠 ×1.5 → bonusPearls = ceil(pearls × 0.5)（呼叫端經 economy 入帳，reason 'challenge'）
export function compareChallenge(mine, theirs) {
  let result;
  if (mine.correct !== theirs.correct) result = mine.correct > theirs.correct ? 'win' : 'lose';
  else if (mine.timeMs !== theirs.timeMs) result = mine.timeMs < theirs.timeMs ? 'win' : 'lose';
  else result = 'tie';
  return { result, bonusPearls: result === 'win' ? Math.ceil((mine.pearls || 0) * 0.5) : 0 };
}

export function recordChallenge(meta, record) {
  meta.challenges.unshift(record);
  if (meta.challenges.length > MAX_CHALLENGES) meta.challenges.length = MAX_CHALLENGES;
  return meta;
}

// players = [{ name, score: { score, correct, answered } }, ...]，兩人對戰結束後的純文字戰報。
export function buildHotseatShareText(players) {
  const sorted = [...players].sort((a, b) => b.score.score - a.score.score);
  const [a, b] = sorted;
  const tie = a.score.score === b.score.score;
  const line = tie
    ? `${a.name} ${a.score.score} : ${b.name} ${b.score.score}，平手！`
    : `${a.name} ${a.score.score} : ${b.name} ${b.score.score}，${a.name} 獲勝！`;
  return `字字珠璣・兩人對戰戰報\n${line}\n（答對 ${a.name} ${a.score.correct}/${a.score.answered}、${b.name} ${b.score.correct}/${b.score.answered}）`;
}
