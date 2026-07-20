import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fuse, listCubs, nextCubFor, ensureFusionState, getCrystalBalance,
  CUBS, FUSE_COST,
} from '../js/meta/fusion-store.js';
import { LEVEL_STEP, MAX_LEVEL } from '../js/meta/pet.js';

function readyMeta() {
  const collection = {};
  for (let i = 0; i < MAX_LEVEL * LEVEL_STEP; i++) {
    collection[`zy-${i}`] = { earnedAt: '2026-07-01', wrong: 0 };
  }
  const meta = {
    collection,
    weak: { 字音: { correct: 90, wrong: 10 } },
    pearls: { balance: 0, earnedToday: 0, earnedDate: '' },
  };
  // 直接灌餘額：CRYSTAL_DAILY_CAP(10) < FUSE_COST(30)，走 earnCrystals 會被單日截斷
  ensureFusionState(meta).crystals.balance = FUSE_COST;
  return meta;
}
const okRng = () => 0.5; // ≥ FAIL_RATE → 成功

test('CUBS：全庫 6 隻、每類別 2 隻、稱號池 2–3 個、台詞非空殼', () => {
  assert.equal(CUBS.length, 6);
  for (const cat of ['字音', '成語', '混合']) {
    assert.equal(CUBS.filter((c) => c.category === cat).length, 2);
  }
  for (const c of CUBS) {
    assert.ok(c.titles.length >= 2 && c.titles.length <= 3, `${c.id} 稱號池數量不對`);
    assert.ok(c.bornLine.length >= 10, `${c.id} 誕生台詞過短`);
    assert.ok(c.desc.length >= 8, `${c.id} 簡介過短`);
  }
});

test('fuse 成功：扣墨晶、稚靈入庫、稱號取自該稚靈稱號池', () => {
  const meta = readyMeta();
  const r = fuse(meta, 'baize', 'kui', { rng: okRng, today: '2026-07-20' });
  assert.equal(r.ok, true);
  assert.equal(r.result, 'success');
  assert.equal(r.cub.id, 'tiangou'); // 字音 order 1
  assert.ok(CUBS.find((c) => c.id === 'tiangou').titles.includes(r.cub.title));
  assert.equal(getCrystalBalance(meta), 0);
  const cubs = listCubs(meta);
  assert.equal(cubs.length, 1);
  assert.deepEqual(cubs[0].parents, ['baize', 'kui']);
});

test('fuse：雙親完全不消耗——collection、pet 狀態前後一致（硬性規則）', () => {
  const meta = readyMeta();
  meta.pet = { active: 'baize', nicknames: { baize: '小白' }, bond: { baize: 50 } };
  const collectionBefore = JSON.stringify(meta.collection);
  const petBefore = JSON.stringify(meta.pet);
  fuse(meta, 'baize', 'kui', { rng: okRng, today: '2026-07-20' });
  assert.equal(JSON.stringify(meta.collection), collectionBefore);
  assert.equal(JSON.stringify(meta.pet), petBefore);
});

test('fuse：同類別第二次融合出 order 2；出完回 all-owned 且不扣墨晶', () => {
  const meta = readyMeta();
  ensureFusionState(meta).crystals.balance += FUSE_COST; // 補到兩次份
  fuse(meta, 'baize', 'kui', { rng: okRng, today: '2026-07-20' });
  const r2 = fuse(meta, 'baize', 'jiuwei', { rng: okRng, today: '2026-07-20' });
  assert.equal(r2.cub.id, 'zhujian');
  assert.equal(nextCubFor(meta, '字音'), null);
  const balance = getCrystalBalance(meta);
  const r3 = fuse(meta, 'kui', 'jiuwei', { rng: okRng, today: '2026-07-20' });
  assert.equal(r3.ok, false);
  assert.equal(r3.reason, 'all-owned');
  assert.equal(getCrystalBalance(meta), balance);
});

test('fuse：墨晶不足回 crystals、不出稚靈', () => {
  const meta = readyMeta();
  meta.fusion.crystals.balance = FUSE_COST - 1;
  const r = fuse(meta, 'baize', 'kui', { rng: okRng, today: '2026-07-20' });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'crystals');
  assert.equal(listCubs(meta).length, 0);
});

test('fuse：資格不符直接擋（沿用 canFusePair reason）', () => {
  const meta = readyMeta();
  meta.weak = {};
  assert.equal(fuse(meta, 'baize', 'kui', { rng: okRng }).reason, 'accuracy');
});
