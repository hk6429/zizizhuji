import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fuse, listCubs, ensureFusionState, getCrystalBalance, getPairCooldown,
  FUSE_COST, FAIL_RATE, FAIL_LINES, CONSOLE_PEARLS,
} from '../js/meta/fusion-store.js';
import { CAP_EXEMPT_REASONS, DAILY_EARN_CAP } from '../js/meta/economy.js';
import { LEVEL_STEP, MAX_LEVEL } from '../js/meta/pet.js';

function readyMeta() {
  const collection = {};
  for (let i = 0; i < MAX_LEVEL * LEVEL_STEP; i++) {
    collection[`zy-${i}`] = { earnedAt: '2026-07-01', wrong: 0 };
  }
  const meta = {
    collection,
    weak: { 字音: { correct: 90, wrong: 10 } },
    pearls: { balance: 100, earnedToday: 0, earnedDate: '' },
  };
  ensureFusionState(meta).crystals.balance = FUSE_COST; // 直接灌餘額（單日上限 < FUSE_COST）
  return meta;
}
const failRng = () => FAIL_RATE - 0.01; // < FAIL_RATE → 失敗

test('fuse 失敗：只扣墨晶，不出稚靈，字珠反而拿到安慰回饋', () => {
  const meta = readyMeta();
  const r = fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' });
  assert.equal(r.ok, true);
  assert.equal(r.result, 'fail');
  assert.ok(FAIL_LINES.includes(r.line));
  assert.equal(r.pearls, CONSOLE_PEARLS);
  assert.equal(getCrystalBalance(meta), 0);          // 墨晶扣了
  assert.equal(listCubs(meta).length, 0);            // 沒出稚靈
  assert.equal(meta.pearls.balance, 100 + CONSOLE_PEARLS); // 字珠不減反增
});

test('fuse 失敗：雙親與圖鑑完全不動（白帽硬性規則）', () => {
  const meta = readyMeta();
  meta.pet = { active: 'baize', bond: { baize: 30 } };
  const before = JSON.stringify({ c: meta.collection, p: meta.pet });
  fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' });
  assert.equal(JSON.stringify({ c: meta.collection, p: meta.pet }), before);
});

test('安慰字珠走豁免通道，不吃每日 120 珠上限', () => {
  assert.ok(CAP_EXEMPT_REASONS.has('fusion-consolation'));
  const meta = readyMeta();
  meta.pearls.earnedToday = DAILY_EARN_CAP; // 今日已領滿
  meta.pearls.earnedDate = '2026-07-20';
  fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' });
  assert.equal(meta.pearls.balance, 100 + CONSOLE_PEARLS);
});

test('FAIL_LINES：至少 3 句、每句非空殼', () => {
  assert.ok(FAIL_LINES.length >= 3);
  for (const l of FAIL_LINES) assert.ok(l.length >= 10);
});

// —— WP2 Task 2：融合失敗當日冷卻（白帽時間成本，非資產沒收）——

test('融合失敗後，同一對雙親當日冷卻，不能立刻再試', () => {
  const meta = readyMeta();
  ensureFusionState(meta).crystals.balance = FUSE_COST * 2; // 給足兩次的墨晶，驗證第二次不被扣款
  const r1 = fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' });
  assert.equal(r1.result, 'fail');
  assert.equal(getCrystalBalance(meta), FUSE_COST); // 第一次扣了一次

  const r2 = fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' });
  assert.equal(r2.ok, false);
  assert.equal(r2.reason, 'cooldown');
  assert.equal(getCrystalBalance(meta), FUSE_COST); // 冷卻擋在扣款之前，沒有被沒收更多墨晶
});

test('冷卻只鎖同一對雙親，不影響其他雙親（不同對可正常融合）', () => {
  const meta = readyMeta();
  ensureFusionState(meta).crystals.balance = FUSE_COST * 2;
  const r1 = fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' });
  assert.equal(r1.result, 'fail');

  // baize×bifang 是不同的一對雙親（字音類 4 隻共用等級，皆已滿級），不受冷卻影響。
  const r2 = fuse(meta, 'baize', 'bifang', { rng: failRng, today: '2026-07-20' });
  assert.equal(r2.ok, true);
  assert.notEqual(r2.reason, 'cooldown');
});

test('冷卻不分雙親輸入順序（A×B 與 B×A 視為同一對）', () => {
  const meta = readyMeta();
  fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' });
  assert.equal(getPairCooldown(meta, 'kui', 'baize', '2026-07-20').onCooldown, true);
});

test('冷卻隔天自動解除（today 字串不同即可再試）', () => {
  const meta = readyMeta();
  ensureFusionState(meta).crystals.balance = FUSE_COST * 2;
  fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' });
  assert.equal(getPairCooldown(meta, 'baize', 'kui', '2026-07-21').onCooldown, false);
  const r2 = fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-21' });
  assert.equal(r2.ok, true);
  assert.equal(r2.result, 'fail'); // 隔天可以再試（本例仍模擬失敗）
});

test('冷卻是時間成本，不是資產沒收：雙親等級與圖鑑不因冷卻被扣', () => {
  const meta = readyMeta();
  ensureFusionState(meta).crystals.balance = FUSE_COST * 2;
  fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' });
  const before = JSON.stringify(meta.collection);
  const r2 = fuse(meta, 'baize', 'kui', { rng: failRng, today: '2026-07-20' }); // 冷卻擋下
  assert.equal(r2.ok, false);
  assert.equal(JSON.stringify(meta.collection), before); // 圖鑑（雙親等級來源）完全不動
});
