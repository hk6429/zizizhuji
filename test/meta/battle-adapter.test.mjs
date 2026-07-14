import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import { earnPearls } from '../../js/meta/economy.js';
import { buyGear, setLoadout } from '../../js/meta/gear.js';
import { syncUnlocks, equipArt } from '../../js/meta/arts.js';
import {
  createBattleContext, createBattleStateEx, applyAnswerEx, castArtEx,
  takeEliminate, applyEncounterEffect, applyHeal, isOverEx,
} from '../../js/meta/battle-adapter.js';
import { createBattleState, applyAnswer } from '../../js/battle.js';

function metaWithGear(...gearIds) {
  const meta = defaultMeta();
  earnPearls(meta, 2200, 'achievement', '2026-07-14');
  for (const id of gearIds) buyGear(meta, id);
  setLoadout(meta, gearIds.slice(0, 2));
  return meta;
}

test('bare context mirrors battle.js for normal answers', () => {
  const ctx = createBattleContext(defaultMeta());
  let state = createBattleStateEx(ctx);
  assert.deepEqual(state, createBattleState());
  let expected = createBattleState();
  for (const correct of [true, true, true, false, true]) {
    ({ state } = applyAnswerEx(state, 'A', correct, ctx));
    expected = applyAnswer(expected, 'A', correct);
  }
  assert.deepEqual(state, expected); // combo <5 時護符不介入，行為一致
});

test('澄心紙 raises player max hp to 120', () => {
  const ctx = createBattleContext(metaWithGear('chengxin'));
  const state = createBattleStateEx(ctx);
  assert.equal(state.hpA, 120);
  assert.equal(state.hpB, 100);
});

test('狼毫筆 lowers combo threshold to 2', () => {
  const ctx = createBattleContext(metaWithGear('langhao'));
  let state = createBattleStateEx(ctx);
  ({ state } = applyAnswerEx(state, 'A', true, ctx)); // combo 1 → 10 傷
  ({ state } = applyAnswerEx(state, 'A', true, ctx)); // combo 2 → 15 傷（門檻 2）
  assert.equal(state.hpB, 100 - 10 - 15);
});

test('湖穎筆 adds +2 damage on 字音 questions only', () => {
  const ctx = createBattleContext(metaWithGear('huying'));
  let state = createBattleStateEx(ctx);
  ({ state } = applyAnswerEx(state, 'A', true, ctx, '字音'));
  assert.equal(state.hpB, 88); // 10+2
  ({ state } = applyAnswerEx(state, 'A', true, ctx, '成語'));
  assert.equal(state.hpB, 78); // 無加成
});

test('松煙墨 shields the first miss per battle', () => {
  const ctx = createBattleContext(metaWithGear('songyan'));
  let state = createBattleStateEx(ctx);
  ({ state } = applyAnswerEx(state, 'A', true, ctx));
  let r = applyAnswerEx(state, 'A', false, ctx);
  state = r.state;
  assert.equal(state.comboA, 1); // 連對保住
  assert.ok(r.events.some(e => e.type === 'comboShielded'));
  r = applyAnswerEx(state, 'A', false, ctx); // 第二次沒得擋
  assert.equal(r.state.comboA, 0);
});

test('油煙墨 reflects 3 damage on miss', () => {
  const ctx = createBattleContext(metaWithGear('youyan'));
  const state = createBattleStateEx(ctx);
  const r = applyAnswerEx(state, 'A', false, ctx);
  assert.equal(r.state.hpB, 97);
  assert.ok(r.events.some(e => e.type === 'reflect'));
});

test('端硯 heals 4 per correct answer, capped at max hp', () => {
  const ctx = createBattleContext(metaWithGear('duanyan'));
  let state = { ...createBattleStateEx(ctx), hpA: 50 };
  ({ state } = applyAnswerEx(state, 'A', true, ctx));
  assert.equal(state.hpA, 54);
  state = { ...state, hpA: 100 };
  ({ state } = applyAnswerEx(state, 'A', true, ctx));
  assert.equal(state.hpA, 100); // 不溢出
});

test('歙硯 bursts 30 once when combo reaches 5', () => {
  const ctx = createBattleContext(metaWithGear('sheyan'));
  let state = createBattleStateEx(ctx);
  for (let i = 0; i < 4; i++) ({ state } = applyAnswerEx(state, 'A', true, ctx));
  const hpBefore = state.hpB;
  const r = applyAnswerEx(state, 'A', true, ctx); // combo 5 → 15 + 30 爆發
  assert.equal(r.state.hpB, Math.max(0, hpBefore - 15 - 30));
  assert.ok(r.events.some(e => e.type === 'burst'));
  // 每場只一次
  const r2 = applyAnswerEx(r.state, 'A', true, ctx);
  assert.ok(!r2.events.some(e => e.type === 'burst'));
});

test('玉版紙 adds +3 damage from the 10th question on', () => {
  const ctx = createBattleContext(metaWithGear('yuban'));
  let state = { ...createBattleStateEx(ctx), hpB: 1000 }; // 避免提早歸零：手動放大
  // battle.js Math.max(0,...) 仍适用；hpB 大於 0 即可觀察傷害
  for (let i = 0; i < 9; i++) ({ state } = applyAnswerEx(state, 'A', false, ctx)); // 前 9 題答錯墊題數
  const before = state.hpB;
  ({ state } = applyAnswerEx(state, 'A', true, ctx)); // 第 10 題
  assert.equal(before - state.hpB, 10 + 3);
});

test('護心墨符 halves a 5+ combo once (built into every battle)', () => {
  const ctx = createBattleContext(defaultMeta());
  let state = createBattleStateEx(ctx);
  for (let i = 0; i < 6; i++) ({ state } = applyAnswerEx(state, 'A', true, ctx));
  assert.equal(state.comboA, 6);
  const r = applyAnswerEx(state, 'A', false, ctx);
  assert.equal(r.state.comboA, 3); // floor(6/2)
  assert.ok(r.events.some(e => e.type === 'charmTriggered' && e.payload.charm === 'combo'));
});

test('書生殘卷 floors player hp at 10 once when opponent attacks', () => {
  const ctx = createBattleContext(defaultMeta());
  let state = { ...createBattleStateEx(ctx), hpA: 12 };
  let r = applyAnswerEx(state, 'B', true, ctx); // 對手打 10 → 2 → 保底 10
  assert.equal(r.state.hpA, 10);
  assert.ok(r.events.some(e => e.type === 'charmTriggered' && e.payload.charm === 'scroll'));
  r = applyAnswerEx(r.state, 'B', true, ctx); // 第二次不再保
  assert.equal(r.state.hpA, 0);
  assert.equal(isOverEx(r.state, ctx), true);
});

test('潑墨訣 double damage one-shot via castArtEx', () => {
  const meta = defaultMeta();
  meta.arts.battlesWon = 15;
  syncUnlocks(meta);
  equipArt(meta, 'pomo');
  const ctx = createBattleContext(meta);
  let state = createBattleStateEx(ctx);
  for (let i = 0; i < 5; i++) ({ state } = applyAnswerEx(state, 'A', true, ctx)); // 存滿墨氣
  const cast = castArtEx(ctx);
  assert.equal(cast.ok, true);
  assert.equal(ctx.oneShot.doubleDamage, true);
  const hpBefore = state.hpB;
  const r = applyAnswerEx(state, 'A', true, ctx); // combo 6 → 15×2
  assert.equal(hpBefore - r.state.hpB, 30);
  assert.equal(ctx.oneShot.doubleDamage, false); // one-shot 用掉
});

test('守心訣 shields the next 2 misses', () => {
  const meta = defaultMeta();
  meta.arts.battlesWon = 30;
  syncUnlocks(meta);
  equipArt(meta, 'shouxin');
  const ctx = createBattleContext(meta);
  let state = createBattleStateEx(ctx);
  for (let i = 0; i < 5; i++) ({ state } = applyAnswerEx(state, 'A', true, ctx));
  castArtEx(ctx);
  assert.equal(ctx.oneShot.shieldCount, 2);
  let r = applyAnswerEx(state, 'A', false, ctx);
  assert.equal(r.state.comboA, 5);
  r = applyAnswerEx(r.state, 'A', false, ctx);
  assert.equal(r.state.comboA, 5);
  r = applyAnswerEx(r.state, 'A', false, ctx); // 盾用完 → 護心墨符減半
  assert.equal(r.state.comboA, 2);
});

test('encounter effects land on ctx; eliminate is consumed via takeEliminate', () => {
  const ctx = createBattleContext(defaultMeta());
  applyEncounterEffect(ctx, { effect: { type: 'comboThreshold', value: 2 } });
  assert.equal(ctx.comboThresholdOverride, 2);
  applyEncounterEffect(ctx, { effect: { type: 'eliminate', count: 1 } });
  assert.equal(takeEliminate(ctx), 1);
  assert.equal(takeEliminate(ctx), 0); // 取用後歸零
});

test('applyHeal caps at the right max hp per side', () => {
  const ctx = createBattleContext(metaWithGear('chengxin'));
  let state = { ...createBattleStateEx(ctx), hpA: 115 };
  state = applyHeal(state, 'A', 10, ctx);
  assert.equal(state.hpA, 120);
  state = { ...state, hpB: 95 };
  state = applyHeal(state, 'B', 10, ctx);
  assert.equal(state.hpB, 100);
});

test('明目日 free eliminate arrives via context options', () => {
  const ctx = createBattleContext(defaultMeta(), { freeEliminate: 1 });
  assert.equal(takeEliminate(ctx), 1);
});
