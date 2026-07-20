import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fuse, listCubs, ensureFusionState, getCrystalBalance,
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
