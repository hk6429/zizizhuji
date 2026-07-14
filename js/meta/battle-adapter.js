// 戰鬥包裝層：不改 battle.js。組合 gear mods＋煉字三訣 one-shot＋奇遇 buff＋護符雙保險。
// 對手（side B）永遠走原版 applyAnswer 規則；玩家（side A）疊加各種修正。
// BattleCtx 為純資料，一場一顆；事件 {type, payload, fx} 回給 UI。

import { createBattleState, applyAnswer, isBattleOver } from '../battle.js';
import { getModifiers } from './gear.js';
import { createArtSession, gainInk, castArt, INK_MAX, MAX_CASTS } from './arts.js';
import { createBattleGuards, guardCombo, guardHp } from './charms.js';

const BASE_DAMAGE = 10; // 與 battle.js 同步的基礎值（battle.js 未輸出常數）

// opts.damageBonus：天機「墨雨日」+2；opts.freeEliminate：天機「明目日」開局送一次排除。
export function createBattleContext(meta, opts = {}) {
  return {
    mods: getModifiers(meta),
    art: createArtSession(meta),
    guards: createBattleGuards(),
    questionIndex: 0,     // 玩家已答題數（玉版紙第 10 題起 +3）
    burstUsed: false,     // 歙硯每場一次
    firstMissUsed: false, // 松煙墨每場一次
    comboThresholdOverride: null, // 奇遇「硯台生輝」本場門檻 2
    globalDamageBonus: opts.damageBonus ?? 0,
    oneShot: {
      doubleDamage: false,                    // 潑墨訣 / 奇遇「文曲星閃現」
      shieldCount: 0,                         // 守心訣：接下來 N 題答錯不斷連對
      eliminate: opts.freeEliminate ?? 0,     // 點睛訣 / 奇遇「古卷破損」：UI 取用後呼叫 takeEliminate
    },
  };
}

// 開場用：套 maxHp（澄心紙 120）。不動 createBattleState 簽名，包一層。
export function createBattleStateEx(ctx) {
  const state = createBattleState();
  return { ...state, hpA: ctx.mods.maxHp };
}

function effectiveThreshold(ctx) {
  return Math.min(ctx.mods.comboThreshold, ctx.comboThresholdOverride ?? Infinity);
}

// qtype：'字音' | '字形' | '成語' | null（供法寶題型加傷）。
export function applyAnswerEx(state, side, correct, ctx, qtype = null) {
  const events = [];

  if (side !== 'A') {
    // 對手照原規則打；只在傷到玩家時套「書生殘卷」保底。
    const next = applyAnswer(state, side, correct);
    if (next.hpA < state.hpA) {
      const g = guardHp(next.hpA, ctx.guards);
      if (g.triggered) {
        next.hpA = g.hp;
        ctx.guards = g.guards;
        events.push({
          type: 'charmTriggered',
          payload: { charm: 'scroll', name: '書生殘卷', message: '殘卷微光，護你一息', hp: g.hp },
          fx: 'scroll-light',
        });
      }
    }
    return { state: next, ctx, events };
  }

  ctx.questionIndex += 1;
  let next;

  if (correct) {
    const combo = state.comboA + 1;
    const threshold = effectiveThreshold(ctx);
    let dmg = combo >= threshold ? ctx.mods.comboBonusDamage : BASE_DAMAGE;
    if (qtype && ctx.mods.typeBonus[qtype]) dmg += ctx.mods.typeBonus[qtype];
    if (ctx.mods.lateBonus && ctx.questionIndex >= ctx.mods.lateFrom) dmg += ctx.mods.lateBonus;
    dmg += ctx.globalDamageBonus;
    if (ctx.oneShot.doubleDamage) {
      dmg *= 2;
      ctx.oneShot.doubleDamage = false;
      events.push({ type: 'doubleDamage', payload: { dmg }, fx: 'ink-splash' });
    }
    let burst = 0;
    if (ctx.mods.burst30At5 && combo >= 5 && !ctx.burstUsed) {
      burst = 30;
      ctx.burstUsed = true;
      events.push({ type: 'burst', payload: { dmg: burst, gear: '歙硯' }, fx: 'ink-burst' });
    }
    next = { ...state, comboA: combo, hpB: Math.max(0, state.hpB - dmg - burst) };
    if (ctx.mods.healOnCorrect) {
      next.hpA = Math.min(ctx.mods.maxHp, next.hpA + ctx.mods.healOnCorrect);
    }
    // 墨氣 +1（洮硯再 +1）
    const before = ctx.art.ink;
    ctx.art = gainInk(ctx.art, ctx.mods.inkBonus);
    if (ctx.art.ink >= INK_MAX && before < INK_MAX && ctx.art.artId && ctx.art.casts < MAX_CASTS) {
      events.push({ type: 'artReady', payload: { artId: ctx.art.artId }, fx: 'ink-gauge-full' });
    }
  } else {
    // 答錯：守心訣 → 松煙墨 → 護心墨符 → 歸零，依序擋
    if (ctx.oneShot.shieldCount > 0) {
      ctx.oneShot.shieldCount -= 1;
      next = { ...state };
      events.push({ type: 'comboShielded', payload: { source: 'shouxin', name: '守心訣' }, fx: 'shield-ink' });
    } else if (ctx.mods.firstMissKeepsCombo && !ctx.firstMissUsed) {
      ctx.firstMissUsed = true;
      next = { ...state };
      events.push({ type: 'comboShielded', payload: { source: 'songyan', name: '松煙墨' }, fx: 'shield-ink' });
    } else {
      const g = guardCombo(state.comboA, ctx.guards);
      ctx.guards = g.guards;
      next = { ...state, comboA: g.combo };
      if (g.triggered) {
        events.push({
          type: 'charmTriggered',
          payload: { charm: 'combo', name: '護心墨符', message: '墨符燃起，金光護珠', combo: g.combo },
          fx: 'charm-gold',
        });
      }
    }
    if (ctx.mods.missReflect) {
      next.hpB = Math.max(0, next.hpB - ctx.mods.missReflect);
      events.push({ type: 'reflect', payload: { dmg: ctx.mods.missReflect, gear: '油煙墨' }, fx: 'ink-drip' });
    }
  }
  return { state: next, ctx, events };
}

// 發動已裝備的訣：效果落到 ctx one-shot flag（eliminate 由 UI 用 takeEliminate 取用）。
export function castArtEx(ctx) {
  const r = castArt(ctx.art);
  if (!r.effect) return { ctx, ok: false };
  ctx.art = r.session;
  if (r.effect.type === 'doubleDamage') ctx.oneShot.doubleDamage = true;
  else if (r.effect.type === 'comboShield') ctx.oneShot.shieldCount += r.effect.count;
  else if (r.effect.type === 'eliminate') ctx.oneShot.eliminate += r.effect.count;
  return { ctx, ok: true, effect: r.effect };
}

// UI 呈現題目時呼叫：取出目前累積的「排除錯誤選項」數並歸零。
export function takeEliminate(ctx) {
  const count = ctx.oneShot.eliminate;
  ctx.oneShot.eliminate = 0;
  return count;
}

// 奇遇效果落地（kernel 擲骰後呼叫）。pearls/challenge 類由 kernel/UI 處理。
export function applyEncounterEffect(ctx, event) {
  const eff = event.effect || {};
  if (eff.type === 'doubleDamage') ctx.oneShot.doubleDamage = true;
  else if (eff.type === 'comboThreshold') ctx.comboThresholdOverride = eff.value;
  else if (eff.type === 'eliminate') ctx.oneShot.eliminate += eff.count;
  return ctx;
}

// 字妖突襲挑戰答對回 10 HP 等治療用。
export function applyHeal(state, side, amount, ctx) {
  const key = side === 'A' ? 'hpA' : 'hpB';
  const cap = side === 'A' ? ctx.mods.maxHp : 100;
  return { ...state, [key]: Math.min(cap, state[key] + amount) };
}

export function isOverEx(state, ctx) {
  return isBattleOver(state);
}
