// M12 班級擂台：教室單機輪流玩的無後端排行榜。
// 當日固定 10 題（date 字串 seed 洗題，全班同題）；同道號同日只取最佳一筆；
// 每週一自動歸檔上週榜（保留 4 週）；提供可投影戰報資料。

import { hashStr, isoWeekKey } from './daily.js';

export const BOARD_SIZE = 10;
export const HISTORY_WEEKS = 4;

export const AVATARS = [
  'shusheng', 'moling', 'zhuque', 'qingniao', 'molong', 'yanwa',
  'bixia', 'wenqu', 'zhilin', 'xiaokui', 'mohu', 'yunhe',
];

// mulberry32：以日期 hash 為 seed 的確定性 PRNG
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function getDailyQuestionIds(allIds, dateStr, count = 10) {
  const rng = mulberry32(hashStr(`zzj-arena-${dateStr}`));
  const ids = [...allIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}

function better(a, b) {
  if (a.correct !== b.correct) return a.correct > b.correct;
  return a.timeMs < b.timeMs;
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => (b.correct - a.correct) || (a.timeMs - b.timeMs));
}

export function rolloverIfNeeded(meta, today) {
  const arena = meta.arena;
  const wk = isoWeekKey(today);
  if (arena.week && arena.week !== wk) {
    const top3 = sortEntries(arena.entries).slice(0, 3);
    arena.history.unshift({ week: arena.week, top3 });
    arena.history = arena.history.slice(0, HISTORY_WEEKS);
    arena.entries = [];
  }
  arena.week = wk;
  return meta;
}

// entry = { name, avatar, correct, timeMs, bestCombo }
export function submitEntry(meta, entry, today) {
  rolloverIfNeeded(meta, today);
  const arena = meta.arena;
  const record = {
    name: entry.name,
    avatar: entry.avatar ?? AVATARS[0],
    correct: entry.correct,
    timeMs: entry.timeMs,
    bestCombo: entry.bestCombo ?? 0,
    date: today,
  };
  // 同道號同日只取最佳一筆（防灌水）
  const existingIdx = arena.entries.findIndex(e => e.name === record.name && e.date === today);
  if (existingIdx >= 0) {
    if (better(record, arena.entries[existingIdx])) arena.entries[existingIdx] = record;
  } else {
    arena.entries.push(record);
  }
  const sorted = sortEntries(arena.entries);
  const rank = sorted.findIndex(e => e.name === record.name && e.date === today) + 1;
  return { meta, rank };
}

export function getBoard(meta) {
  return { week: meta.arena.week, entries: sortEntries(meta.arena.entries).slice(0, BOARD_SIZE) };
}

export function getHistory(meta) {
  return meta.arena.history.map(h => ({ week: h.week, top3: h.top3 }));
}

// 可投影全螢幕戰報：大字前三名＋墨靈宣讀式賀詞。
export function buildBroadcast(meta) {
  const { week, entries } = getBoard(meta);
  const top3 = entries.slice(0, 3);
  const champion = top3[0] || null;
  return {
    week,
    top3,
    champion: champion ? champion.name : null,
    championTitle: champion ? '本週珠王' : null,
    heraldLines: champion
      ? [
        `墨靈宣讀：${week} 擂台戰報——`,
        `本週珠王：${champion.name}！答對 ${champion.correct} 題，技驚墨界！`,
        ...top3.slice(1).map((e, i) => `第${i === 0 ? '二' : '三'}名：${e.name}，答對 ${e.correct} 題。`),
        '眾書生聞聲而賀，濁墨退散三尺！',
      ]
      : ['墨靈宣讀：本週擂台虛位以待，誰是第一位挑戰者？'],
  };
}
