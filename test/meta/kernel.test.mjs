import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setStorageBackend, loadMeta } from '../../js/meta/store.js';
import {
  initSession, onPracticeAnswer, onBattleAnswer, onBattleEnd, onPracticeEnd,
} from '../../js/meta/kernel.js';
import { createBattleStateEx } from '../../js/meta/battle-adapter.js';
import { setActivePet, buyEquip, installEquip, getPetBattleMods, categoryMastery } from '../../js/meta/pet.js';

function createMockStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

const D = '2026-07-14';
const BANKS = {
  ziyin: [
    { id: 'zy-1', type: '字音' },
    { id: 'zy-2', type: '字音' },
    { id: 'zy-3', type: '字形' },
  ],
  chengyu: [
    { id: 'cy-1', type: '意義' },
    { id: 'cy-2', type: '意義' },
  ],
};
const NO_ENCOUNTER = () => 0.99; // 永不觸發奇遇（12 題保底前）

beforeEach(() => {
  setStorageBackend(createMockStorage());
});

test('initSession: first visit shows intro, returns omen/lantern/ctx', () => {
  const r = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  assert.ok(r.intro);
  assert.equal(r.intro.cards.length, 3);
  assert.equal(r.intro.oaths.length, 4);
  assert.ok(r.omen.omenId);
  assert.equal(r.lantern.litToday, false);
  assert.deepEqual(r.pendingMilestones, []);
  assert.deepEqual(r.polishTasks, []);
  assert.equal(r.ctx.totals.yin, 2);
  assert.equal(r.ctx.totals.xing, 1);
  assert.equal(r.ctx.totals.chengyu, 2);
  assert.equal(r.ctx.leitner.get('zy-1'), 1);
});

test('practice answer: pearl + xp + purified events, persisted via store', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  const { events } = onPracticeAnswer(ctx, 'zy-1', true);
  const types = events.map(e => e.type);
  assert.ok(types.includes('xpGained'));
  assert.ok(types.includes('pearlEarned'));
  assert.ok(types.includes('purified'));
  // 落盤驗證
  const saved = loadMeta();
  assert.ok(saved.pearls.balance >= 1);
  assert.equal(saved.xp.value >= 10, true);
  assert.deepEqual(saved.world.purified, ['zy-1']);
  assert.equal(saved.leitner['zy-1'], 2); // Leitner 持久化
});

test('戰鬥專用 freeEliminate 設備不會進入練習 context 或改變煉成精通計算', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  ctx.meta.pearls.balance = 500;
  setActivePet(ctx.meta, 'baize');
  assert.equal(buyEquip(ctx.meta, 'ling').ok, true);
  assert.equal(installEquip(ctx.meta, 'baize', 'ling').ok, true);
  assert.equal(getPetBattleMods(ctx.meta).freeEliminate, 1, '前置確認設備確實帶有戰鬥排除效果');
  assert.equal(ctx.battle, null, '練習尚未建立 battle context');

  for (let i = 0; i < 4; i++) onPracticeAnswer(ctx, 'zy-1', true);
  assert.equal(ctx.battle, null, '練習結算不得建立或消耗 battle context');
  assert.equal(categoryMastery(ctx.meta, '字音'), 1, '煉成只依 collection 計算，不受戰鬥設備加成');
});

test('wrong answer still gives consolation xp, no pearls, no purify', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  const { events } = onPracticeAnswer(ctx, 'zy-1', false);
  const types = events.map(e => e.type);
  assert.ok(types.includes('xpGained'));
  assert.equal(events.find(e => e.type === 'xpGained').payload.amount >= 2, true);
  assert.ok(!types.includes('pearlEarned'));
  assert.ok(!types.includes('purified'));
});

test('practice answers update meta.weak keyed by entry.type', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  onPracticeAnswer(ctx, 'zy-1', true); // 字音
  onPracticeAnswer(ctx, 'zy-3', false); // 字形
  onPracticeAnswer(ctx, 'cy-1', true); // 意義（chengyu 細分，非合併的 typeOfId）
  const saved = loadMeta();
  assert.deepEqual(saved.weak['字音'], { correct: 1, wrong: 0 });
  assert.deepEqual(saved.weak['字形'], { correct: 0, wrong: 1 });
  assert.deepEqual(saved.weak['意義'], { correct: 1, wrong: 0 });
  assert.equal(saved.weak['成語'], undefined); // 弱點分類保留細分，不走 typeOfId 的合併桶
});

test('practice answers also accumulate meta.daily.todayAnswered regardless of correctness', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  onPracticeAnswer(ctx, 'zy-1', true);
  onPracticeAnswer(ctx, 'zy-2', false);
  assert.equal(loadMeta().daily.todayAnswered, 2);
});

test('4 straight corrects forge a gold pearl (+3 pearls) through the kernel', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  let events;
  for (let i = 0; i < 4; i++) ({ events } = onPracticeAnswer(ctx, 'zy-1', true));
  const forged = events.find(e => e.type === 'pearlForged');
  assert.ok(forged);
  assert.equal(forged.payload.gradeName, '金珠');
  assert.ok(events.filter(e => e.type === 'pearlEarned').length >= 2); // 答題珠 + 煉成珠
  assert.equal(loadMeta().leitner['zy-1'], 5);
});

test('forging the 10th pearl unlocks 初綴 through the kernel, with per-domain stats', () => {
  const ids = Array.from({ length: 10 }, (_, i) => `zy-f${i}`);
  const banks = { ziyin: ids.map(id => ({ id, type: '字音' })), chengyu: [] };
  const { ctx } = initSession(D, banks, { rng: NO_ENCOUNTER });
  let all = [];
  for (const id of ids) {
    for (let i = 0; i < 4; i++) {
      const { events } = onPracticeAnswer(ctx, id, true);
      all = all.concat(events);
    }
  }
  const forges = all.filter(e => e.type === 'pearlForged');
  assert.equal(forges.length, 10);
  const achEv = all.find(e => e.type === 'achievement' && e.payload.id === 'forge-10');
  assert.ok(achEv);
  assert.equal(achEv.payload.name, '初綴');
  // 成就要在第 10 顆煉成當下（含）之後才蓋章，不可提早
  assert.ok(all.indexOf(achEv) > all.indexOf(forges[9]));
  const saved = loadMeta();
  assert.equal(saved.ach.stats.forgedCount, 10);
  assert.equal(saved.ach.stats.forgedZiyin, 10);
  assert.equal(saved.ach.stats.forgedChengyu, 0);
});

test('forging a chengyu pearl counts into the forgedChengyu domain', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  for (let i = 0; i < 4; i++) onPracticeAnswer(ctx, 'cy-1', true);
  const saved = loadMeta();
  assert.equal(saved.ach.stats.forgedCount, 1);
  assert.equal(saved.ach.stats.forgedZiyin, 0);
  assert.equal(saved.ach.stats.forgedChengyu, 1);
});

test('combo achievements unlock mid-session with pearls (cap-exempt reason)', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  let events;
  for (const id of ['zy-1', 'zy-2', 'zy-3']) ({ events } = onPracticeAnswer(ctx, id, true));
  const achEv = events.find(e => e.type === 'achievement');
  assert.ok(achEv);
  assert.equal(achEv.payload.id, 'combo-3');
});

test('daily lantern lights via kernel after 10 corrects', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  let all = [];
  for (let i = 0; i < 10; i++) {
    const { events } = onPracticeAnswer(ctx, i % 2 ? 'zy-1' : 'cy-1', true);
    all = all.concat(events);
  }
  assert.ok(all.some(e => e.type === 'lanternLit'));
  assert.ok(all.some(e => e.type === 'boxUnlocked'));
  assert.equal(loadMeta().daily.streak, 1);
});

test('battle flow: answers produce bondLine, end produces summary + bond + win pearls', () => {
  const { ctx } = initSession(D, BANKS, { rng: () => 0.5 });
  ctx.rng = NO_ENCOUNTER;
  let state = createBattleStateEx({ mods: { maxHp: 100 } });
  // 玩家連答 10 題全對 → hpB 歸零
  let r;
  for (let i = 0; i < 10; i++) {
    r = onBattleAnswer(ctx, state, 'A', true, 'zy-1');
    state = r.state;
  }
  assert.equal(state.hpB, 0);
  assert.ok(r.events.some(e => e.type === 'bondLine'));
  const end = onBattleEnd(ctx, state);
  assert.equal(end.summary.won, true);
  assert.equal(end.summary.mode, 'battle');
  assert.equal(end.summary.total, 10);
  assert.equal(end.summary.bestCombo, 10);
  assert.ok(typeof end.summary.molingLine === 'string');
  const saved = loadMeta();
  assert.equal(saved.ach.stats.wins, 1);
  assert.equal(saved.ach.stats.battles, 1);
  assert.equal(saved.ach.stats.perfectGames, 1);
  // 羈絆：完成2+勝1+連對5 2+首戰3 = 8
  assert.equal(saved.bond.value, 8);
  // 成就：初戰告捷/三五十連珠/零失手 都該解鎖
  assert.ok(saved.ach.unlocked['first-win']);
  assert.ok(saved.ach.unlocked['combo-10']);
  assert.ok(saved.ach.unlocked['perfect']);
});

test('opponent (side B) answers do not feed player pearls/xp', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  let state = createBattleStateEx({ mods: { maxHp: 100 } });
  const r = onBattleAnswer(ctx, state, 'B', true, 'zy-2');
  assert.equal(r.state.hpA, 90);
  assert.ok(!r.events.some(e => e.type === 'pearlEarned'));
  assert.equal(loadMeta().xp.value, 0);
});

test('battle answers (side A) also update meta.weak', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  let state = createBattleStateEx({ mods: { maxHp: 100 } });
  onBattleAnswer(ctx, state, 'A', true, 'zy-1');
  const saved = loadMeta();
  assert.deepEqual(saved.weak['字音'], { correct: 1, wrong: 0 });
});

test('practice end returns a practice summary card and resets the session', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  onPracticeAnswer(ctx, 'zy-1', true);
  onPracticeAnswer(ctx, 'zy-2', false);
  const { summary, ctx: ctx2 } = onPracticeEnd(ctx);
  assert.equal(summary.mode, 'practice');
  assert.equal(summary.total, 2);
  assert.equal(summary.correct, 1);
  assert.equal(ctx2.session.total, 0);
});

test('encounter fires through the kernel with an injected rng', () => {
  const rolls = [0.01, 0]; // 觸發 → 挑第一格
  let i = 0;
  const { ctx } = initSession(D, BANKS, { rng: () => rolls[Math.min(i++, rolls.length - 1)] });
  const { events } = onPracticeAnswer(ctx, 'zy-1', true);
  const enc = events.find(e => e.type === 'encounter');
  assert.ok(enc);
  assert.equal(enc.payload.id, 'wenqu');
});

test('correct answers accrue per-pet bond for the active pet, decoupled from meta.bond (moling)', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  setActivePet(ctx.meta, 'baize'); // 字音類，unlockAt 0，開局即解鎖
  onPracticeAnswer(ctx, 'zy-1', true);
  onPracticeAnswer(ctx, 'zy-2', false); // 答錯不加羈絆
  const saved = loadMeta();
  assert.equal(saved.pet.bond.baize, 1);
  assert.equal(saved.bond.value, 0); // 墨靈羈絆只在對戰結算才動，跟寵物羈絆是兩條資料線
});

test('lantern tier-up awards a permanent badge to the active pet', () => {
  const { ctx } = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  setActivePet(ctx.meta, 'baize');
  let all = [];
  // 連續 7 天各答對 10 題 → streak 7 → tier 1（銅燈）
  for (let day = 0; day < 7; day++) {
    ctx.today = `2026-07-${String(14 + day).padStart(2, '0')}`;
    for (let i = 0; i < 10; i++) {
      const { events } = onPracticeAnswer(ctx, i % 2 ? 'zy-1' : 'cy-1', true);
      all = all.concat(events);
    }
  }
  assert.ok(all.some(e => e.type === 'lanternTierUp' && e.payload.tier === 1));
  const saved = loadMeta();
  assert.deepEqual(saved.pet.badges.baize, [1]);
});

test('second visit does not show intro again after markIntroSeen was persisted', () => {
  const first = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  first.meta.oath.storySeen = true;
  onPracticeAnswer(first.ctx, 'zy-1', true); // 觸發 saveMeta
  const second = initSession(D, BANKS, { rng: NO_ENCOUNTER });
  assert.equal(second.intro, null);
});
