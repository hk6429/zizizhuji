import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fuse, setCubNickname, buildCubCardData, chooseCubPassive, listCubs,
  ensureFusionState, FUSE_COST,
} from '../js/meta/fusion-store.js';
import { LEVEL_STEP, MAX_LEVEL } from '../js/meta/pet.js';

function metaWithCub() {
  const collection = {};
  for (let i = 0; i < MAX_LEVEL * LEVEL_STEP; i++) {
    collection[`zy-${i}`] = { earnedAt: '2026-07-01', wrong: 0 };
  }
  const meta = {
    collection,
    weak: { 字音: { correct: 90, wrong: 10 } },
    pearls: { balance: 0, earnedToday: 0, earnedDate: '' },
  };
  ensureFusionState(meta).crystals.balance = FUSE_COST; // 直接灌餘額（單日上限 < FUSE_COST）
  fuse(meta, 'baize', 'kui', { rng: () => 0.5, today: '2026-07-20' });
  return meta;
}

test('setCubNickname：1–8 字可設、超長擋下、空字串清除回本名', () => {
  const meta = metaWithCub();
  assert.equal(setCubNickname(meta, 'tiangou', '汪汪').ok, true);
  assert.equal(listCubs(meta)[0].displayName, '汪汪');
  assert.equal(setCubNickname(meta, 'tiangou', '一二三四五六七八九').reason, 'too-long');
  assert.equal(setCubNickname(meta, 'tiangou', '  ').ok, true); // trim 後空＝清除
  assert.equal(listCubs(meta)[0].displayName, '天狗');
  assert.equal(setCubNickname(meta, 'hundun', 'x').reason, 'not-owned');
});

test('buildCubCardData：含雙親中文名、稱號、被動名、圖鑑完成度', () => {
  const meta = metaWithCub();
  chooseCubPassive(meta, 'tiangou', 'inkfang');
  setCubNickname(meta, 'tiangou', '小吠');
  const d = buildCubCardData(meta, 'tiangou');
  assert.equal(d.displayName, '小吠');
  assert.equal(d.name, '天狗');
  assert.deepEqual(d.parents, [{ id: 'baize', name: '白澤' }, { id: 'kui', name: '夔' }]);
  assert.equal(d.passiveName, '墨牙');
  assert.equal(d.cubCount, 1);
  assert.equal(d.imgSrc, 'assets/web/cub-tiangou.jpg');
  assert.ok(d.title.length >= 2);
});

test('buildCubCardData：未擁有回 null', () => {
  assert.equal(buildCubCardData(metaWithCub(), 'hundun'), null);
});
