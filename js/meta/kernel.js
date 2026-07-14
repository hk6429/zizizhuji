// 唯一整合接縫（facade）：主控只接 4 個呼叫點，kernel 扇出至所有模組、彙整事件陣列、統一 saveMeta。
// 事件物件一律 {type, payload, fx}。詳細接線規格見 docs/octalysis-integration.md。

import { loadMeta, saveMeta } from './store.js';
import { earnPearls } from './economy.js';
import * as oath from './oath.js';
import * as world from './world.js';
import * as collection from './collection.js';
import * as progress from './progress.js';
import * as arts from './arts.js';
import * as encounter from './encounter.js';
import * as daily from './daily.js';
import * as bond from './bond.js';
import * as arena from './arena.js';
import * as ach from './achievements.js';
import * as summaryMod from './summary.js';
import * as adapter from './battle-adapter.js';
import { recordAnswer } from '../leitner.js';

const XP_PRACTICE = 10;
const XP_BATTLE = 15;
const XP_COMBO_BONUS = 5;
const XP_WRONG = 2; // 安慰值
const PEARL_FORGE = 3;
const PEARL_POLISH = 2;
const PEARL_WIN = 5;

function newSession() {
  return { correct: 0, total: 0, combo: 0, bestCombo: 0, combo5: false, pearls: 0, xp: 0, events: [] };
}

function omenMults(omen) {
  const id = omen ? omen.omenId : null;
  return {
    xp: id === 'wenqu' ? 1.5 : 1,
    pearl: id === 'zhufeng' ? 2 : 1,
    practicePearlBonus: id === 'jingxin' ? 1 : 0,
    encounterRate: id === 'linggan' ? 0.15 : encounter.BASE_RATE,
    bondMult: id === 'lianxin' ? 2 : 1,
    damageBonus: id === 'moyu' ? 2 : 0,
    freeEliminate: id === 'mingmu' ? 1 : 0,
  };
}

// 網站載入時呼叫一次。
// today：'YYYY-MM-DD' 本地日期字串。
// banks：{ ziyin: entries[], chengyu: entries[] }（quiz-loader 過完的 usable 陣列）；
//        傳了才有淨化/圖鑑/Leitner 持久化（強烈建議傳）。
// opts.rng：可注入亂數（測試用）。
export function initSession(today, banks = null, opts = {}) {
  const meta = loadMeta();
  arts.syncUnlocks(meta);
  arena.rolloverIfNeeded(meta, today);

  const zoneOfId = new Map();
  const typeOfId = new Map();
  const totals = { yin: 0, xing: 0, chengyu: 0 };
  let allIds = [];
  if (banks) {
    const entries = [...(banks.ziyin || []), ...(banks.chengyu || [])];
    for (const entry of entries) {
      const zone = world.zoneOf(entry);
      zoneOfId.set(entry.id, zone);
      typeOfId.set(entry.id, zone === 'chengyu' ? '成語' : entry.type);
      totals[zone] += 1;
    }
    allIds = entries.map(e => e.id);
  }

  const omen = daily.getOmen(today);
  const lantern = daily.getLanternState(meta, today);
  const pendingMilestones = banks ? world.pendingMilestones(meta, totals) : [];
  const polishTasks = collection.getPolishTasks(meta);

  const ctx = {
    meta,
    today,
    totals,
    zoneOfId,
    typeOfId,
    omen,
    rng: opts.rng ?? Math.random,
    leitner: banks ? collection.loadLeitnerState(meta, allIds) : null,
    doublePearlNext: false, // 練習奇遇「下題雙倍珠」
    session: newSession(),
    battle: null,
  };
  saveMeta(meta);
  return {
    ctx,
    meta,
    intro: oath.shouldShowIntro(meta) ? { cards: oath.INTRO_CARDS, oaths: oath.OATHS } : null,
    omen,
    lantern,
    pendingMilestones,
    polishTasks,
  };
}

function pushAchievements(ctx, events) {
  const meta = ctx.meta;
  const stats = { ...meta.ach.stats, lanternBest: Math.max(meta.ach.stats.lanternBest || 0, meta.daily.best) };
  const ids = ach.checkAchievements(stats);
  const { newlyUnlocked } = ach.unlock(meta, ids);
  for (const def of newlyUnlocked) {
    const r = earnPearls(meta, def.pearls, 'achievement', ctx.today);
    events.push({
      type: 'achievement',
      payload: { id: def.id, name: def.name, desc: def.desc, title: def.title ?? null, pearls: r.earned },
      fx: 'ink-stamp',
    });
  }
}

function grantPearls(ctx, amount, reason, events) {
  const r = earnPearls(ctx.meta, amount, reason, ctx.today);
  if (r.earned > 0 || r.capped) {
    events.push({ type: 'pearlEarned', payload: { amount: r.earned, reason, capped: r.capped }, fx: 'pearl-pop' });
    ctx.session.pearls += r.earned;
  }
  return r;
}

// 練習/對戰共用的單題結算管線。回傳事件陣列（同時累進 session）。
function processAnswer(ctx, id, correct, mode) {
  const { meta, today } = ctx;
  const events = [];
  const mults = omenMults(ctx.omen);
  const s = ctx.session;

  // session 統計
  s.total += 1;
  if (correct) {
    s.correct += 1;
    s.combo += 1;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    if (s.combo >= 5) s.combo5 = true;
  } else {
    s.combo = 0;
  }

  // 文氣
  let xp = correct ? (mode === 'battle' ? XP_BATTLE : XP_PRACTICE) : XP_WRONG;
  if (correct && s.combo >= 3) xp += XP_COMBO_BONUS;
  xp = Math.round(xp * mults.xp);
  const xpRes = progress.addXp(meta, xp);
  s.xp += xp;
  events.push({ type: 'xpGained', payload: { amount: xp }, fx: 'xp-rise' });
  if (xpRes.leveledUp) {
    events.push({ type: 'levelUp', payload: xpRes.newRank, fx: 'rank-glow' });
  }

  // 字珠
  if (correct) {
    let pearls = 1 + (s.combo >= 3 ? 1 : 0); // 連對第 3 題起每題加碼 +1
    if (mode === 'practice') pearls += mults.practicePearlBonus; // 靜心日
    pearls *= mults.pearl; // 珠豐日 ×2
    if (ctx.doublePearlNext) {
      pearls *= 2;
      ctx.doublePearlNext = false;
    }
    grantPearls(ctx, pearls, `${mode}-answer`, events);
  }

  // 淨化（首次答對）＋墨界回信
  if (correct && id && ctx.zoneOfId.has(id)) {
    const zone = ctx.zoneOfId.get(id);
    const pr = world.purify(meta, id, zone);
    if (pr.newlyPurified) {
      events.push({ type: 'purified', payload: { id, zone }, fx: 'pearl-clean' });
      for (const letter of world.pendingMilestones(meta, ctx.totals)) {
        world.markMilestoneSeen(meta, letter.id);
        events.push({ type: 'worldLetter', payload: letter, fx: 'letter-unfold' });
      }
    }
  }

  // Leitner ＋ 圖鑑（煉成/品階/蒙塵/擦亮）
  if (id && ctx.leitner) {
    recordAnswer(ctx.leitner, id, correct);
    const newBox = ctx.leitner.get(id);
    const cr = collection.onQuestionResult(meta, id, correct, newBox);
    for (const ev of cr.events) {
      events.push(ev);
      if (ev.payload && ev.payload.setBox) ctx.leitner.set(id, ev.payload.setBox); // 蒙塵→3 / 擦亮→5
      if (ev.type === 'pearlForged') grantPearls(ctx, PEARL_FORGE, 'forge', events);
      if (ev.type === 'pearlPolished') grantPearls(ctx, PEARL_POLISH, 'polish', events);
    }
    collection.persistLeitner(meta, ctx.leitner);
  }

  // 累計統計 ＋ 每日三事
  ach.recordStats(meta, { totalAnswered: 1, totalCorrect: correct ? 1 : 0, bestCombo: s.combo });
  const dr = daily.recordDailyCorrect(meta, correct ? 1 : 0, today);
  events.push(...dr.events);

  // 成就（連對/累計題數/守燈類會在答題中途成立）
  pushAchievements(ctx, events);

  // 奇遇
  const er = encounter.rollEncounter(meta, mode, ctx.rng, { rate: mults.encounterRate });
  if (er.event) {
    events.push({ type: 'encounter', payload: er.event, fx: 'encounter-swirl' });
    const eff = er.event.effect || {};
    if (eff.type === 'pearls') grantPearls(ctx, eff.amount, 'encounter', events);
    else if (eff.type === 'doublePearls') ctx.doublePearlNext = true;
    else if (mode === 'battle' && ctx.battle) adapter.applyEncounterEffect(ctx.battle, er.event);
    // eff.type==='challenge'（字妖突襲）由 UI 插入挑戰題；答對用 adapter.applyHeal 回血
  }

  s.events.push(...events);
  return events;
}

// 練習答完一題。
export function onPracticeAnswer(ctx, id, correct) {
  const events = processAnswer(ctx, id, correct, 'practice');
  saveMeta(ctx.meta);
  return { ctx, events };
}

// 對戰答完一題（雙方都走這裡；side 'A'=玩家、'B'=墨靈）。
// id 可選：給了才會計淨化/Leitner/題型加傷。
export function onBattleAnswer(ctx, state, side, correct, id = null) {
  if (!ctx.battle) {
    const mults = omenMults(ctx.omen);
    ctx.battle = adapter.createBattleContext(ctx.meta, {
      damageBonus: mults.damageBonus,
      freeEliminate: mults.freeEliminate,
    });
  }
  const qtype = id && ctx.typeOfId.has(id) ? ctx.typeOfId.get(id) : null;
  const r = adapter.applyAnswerEx(state, side, correct, ctx.battle, qtype);
  const events = [...r.events];

  if (side === 'A') {
    events.push(...processAnswer(ctx, id, correct, 'battle'));
    // 護盾可能保住 comboA，session 的 bestCombo 以戰鬥實際 combo 為準
    ctx.session.bestCombo = Math.max(ctx.session.bestCombo, r.state.comboA);
    if (r.state.comboA >= 5) ctx.session.combo5 = true;
    const b = bond.getBond(ctx.meta);
    const situation = correct ? (r.state.comboA >= 3 ? 'combo3' : 'correct') : 'wrong';
    events.push({
      type: 'bondLine',
      payload: { line: bond.pickLine(b.stage, situation, ctx.rng), stage: b.stage },
      fx: 'speech-bubble',
    });
    ctx.session.events.push(...r.events);
  }

  saveMeta(ctx.meta);
  return { ctx, state: r.state, events };
}

// 對戰結束（isOverEx 為真、或題目打完後呼叫）。
export function onBattleEnd(ctx, state) {
  const meta = ctx.meta;
  const s = ctx.session;
  const events = [];
  const won = state.hpB <= 0;
  const mults = omenMults(ctx.omen);

  if (won) grantPearls(ctx, PEARL_WIN, 'battle-win', events);

  ach.recordStats(meta, {
    battles: 1,
    wins: won ? 1 : 0,
    perfectGames: won && s.total > 0 && s.correct === s.total ? 1 : 0,
  });

  if (won) {
    meta.arts.battlesWon += 1;
    const { newlyUnlocked } = arts.syncUnlocks(meta);
    for (const art of newlyUnlocked) {
      events.push({ type: 'artUnlocked', payload: { id: art.id, name: art.name, desc: art.desc }, fx: 'scroll-open' });
    }
  }

  // 羈絆：完成 +2 / 勝 +1 / 單場連對≥5 +2 / 每日首戰 +3（連心日 ×2）
  const bondEvents = ['battleComplete'];
  if (won) bondEvents.push('win');
  if (s.combo5) bondEvents.push('combo5');
  bondEvents.push('dailyFirst');
  for (const be of bondEvents) {
    const br = bond.addBond(meta, be, ctx.today, mults.bondMult);
    if (br.stageUp) events.push({ type: 'bondStageUp', payload: br.stageUp, fx: 'bond-bloom' });
    for (const gift of br.gifts) events.push({ type: 'gift', payload: gift, fx: 'gift-open' });
  }

  pushAchievements(ctx, events);

  const summary = summaryMod.buildBattleSummary(
    { won, correct: s.correct, total: s.total, bestCombo: s.bestCombo },
    [...s.events, ...events],
    meta,
  );
  saveMeta(meta);
  ctx.battle = null;
  ctx.session = newSession();
  return { ctx, summary, events };
}

// 練習結束。
export function onPracticeEnd(ctx) {
  const s = ctx.session;
  const events = [];
  pushAchievements(ctx, events);
  const summary = summaryMod.buildPracticeSummary(
    { correct: s.correct, total: s.total, bestCombo: s.bestCombo, pearls: s.pearls, xp: s.xp },
    ctx.meta,
  );
  saveMeta(ctx.meta);
  ctx.session = newSession();
  return { ctx, summary, events };
}
