// 即時對戰純邏輯：同 seed 不同機出同一組題；傷害權威在攻擊方。
// UI 層在 js/rtbattle-ui.js；本檔零 DOM、零網路，全部可 node --test。
import { BATTLE_EVENTS } from './encounter.js';

export const ROUNDS = 20;
export const ROUND_SEC = 15;
export const POLL_MS = 1500;
export const DEAD_MS = 20000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildQuestions(seed, entries, rounds = ROUNDS) {
  const rng = mulberry32(seed);
  // 先依 id 排序：兩機的 entries 載入順序不同也能出同序（同 vocab-duel 手法）
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : 1));
  const pick = [];
  const used = new Set();
  while (pick.length < Math.min(rounds, sorted.length) && used.size < sorted.length) {
    const i = Math.floor(rng() * sorted.length);
    if (used.has(i)) continue;
    used.add(i);
    pick.push(sorted[i]);
  }
  return pick.map((e) => {
    const options = [...e.options];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { id: e.id, type: e.type, question: e.question, options, answer: e.answer, explain: e.explain || [] };
  });
}

export const ENCOUNTER_EVERY = 5;
// applyEncounterEffect 只吃這三種效果（pearls/challenge 是 kernel/UI 的事，rt 不用）
// 白帽張力校準：doubleDamage 一律只在「答對」那格才乘倍（battle-adapter 內建規則，答錯本來就不造成
// 傷害），已符合「運氣只放大答對驅動的傷害，不會無中生有」。但即時對戰是 20 題定輸贏的零和賽，
// 原始權重表裡 doubleDamage 佔比過高（30／全部 55 ≈ 55%），單場勝負太容易被「剛好卡在雙倍傷害那格」
// 帶偏。這裡只降低 doubleDamage 在「即時對戰限定」事件池裡的權重，不動 encounter.js 共用表
// （練習模式/其他戰鬥仍用原權重），讓答題表現維持最大決勝因素。
const RT_WEIGHT_OVERRIDE = { doubleDamage: 15 };
const RT_EVENTS = BATTLE_EVENTS
  .filter(e => ['doubleDamage', 'eliminate', 'comboThreshold'].includes(e.effect.type))
  .map(e => (RT_WEIGHT_OVERRIDE[e.effect.type] != null ? { ...e, weight: RT_WEIGHT_OVERRIDE[e.effect.type] } : e));

export function buildEncounterScript(seed, rounds = ROUNDS, every = ENCOUNTER_EVERY) {
  const rng = mulberry32((seed ^ 0x5EEDCAFE) >>> 0); // 與出題 rng 分流，互不干擾
  const script = new Map();
  let lastId = null;
  for (let at = every; at <= rounds; at += every) {
    const pool = RT_EVENTS.filter(e => e.id !== lastId);
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let roll = rng() * total;
    let picked = pool[pool.length - 1];
    for (const e of pool) { roll -= e.weight; if (roll < 0) { picked = e; break; } }
    lastId = picked.id;
    script.set(at, picked);
  }
  return script;
}

export function dealtDamage(prevState, nextState) {
  return Math.max(0, prevState.hpB - nextState.hpB);
}

// ---------- 單人挑戰「今日墨靈刺客」：不需要真人對手也能完整走一場對戰 ----------
// 用日期字串（YYYY-MM-DD）做決定性種子：同一天、任何裝置都算出同一個目標，
// 不可用 Date.now()／Math.random，才能讓題目與刺客防線每天固定、可測試。
export function assassinSeed(dateStr) {
  let h = 2166136261 >>> 0; // FNV-1a 32-bit offset basis
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// 刺客防線＝當日輸出目標值。BASE/SPAN 取一個「全對＋部分連對加成」量級內的合理值，
// 讓認真作答的孩子有機會打贏，又不會隨便亂點就過關。
export const ASSASSIN_BASE = 140;
export const ASSASSIN_SPAN = 60;

export function assassinTargetScore(dateStr) {
  const rng = mulberry32(assassinSeed(dateStr));
  return ASSASSIN_BASE + Math.floor(rng() * ASSASSIN_SPAN);
}

export function judge({ myHp, oppHp, myDone, oppDone, oppHbAgeMs }) {
  if (oppHbAgeMs > DEAD_MS) return 'win'; // 對手斷線
  if (myHp <= 0 && oppHp <= 0) return 'draw';
  if (myHp <= 0) return 'lose';
  if (oppHp <= 0) return 'win';
  if (myDone && oppDone) return myHp > oppHp ? 'win' : myHp < oppHp ? 'lose' : 'draw';
  return null;
}
