import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHUYUAN_KEY, setStorageBackend, defaultShuyuan, loadShuyuan, saveShuyuan,
  getGateStage, getCourtyards, flourishTier, FLOURISH_TIERS, COURTYARDS,
} from '../js/meta/shuyuan-store.js';
import { defaultMeta } from '../js/meta/store.js';

function mockStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('defaultShuyuan 給出空佈局初始狀態', () => {
  const s = defaultShuyuan();
  assert.equal(s.v, 1);
  assert.equal(s.seeded, false);
  assert.deepEqual(s.placements, {});
  assert.deepEqual(s.styles, {});
  assert.deepEqual(s.plaques, {});
  assert.equal(s.couplet, null);
  assert.deepEqual(s.celebrated, []);
});

test('saveShuyuan 後 loadShuyuan 讀回相同狀態（key = zz_shuyuan）', () => {
  const backend = mockStorage();
  setStorageBackend(backend);
  const s = defaultShuyuan();
  s.placements['lantern-0'] = { x: 30, y: 60 };
  assert.equal(saveShuyuan(s), true);
  assert.notEqual(backend.getItem(SHUYUAN_KEY), null);
  const loaded = loadShuyuan();
  assert.deepEqual(loaded.placements, { 'lantern-0': { x: 30, y: 60 } });
  setStorageBackend(null);
});

test('loadShuyuan 遇壞資料退回預設，且補齊缺欄位', () => {
  const backend = mockStorage();
  setStorageBackend(backend);
  backend.setItem(SHUYUAN_KEY, '{"placements"');           // 壞 JSON
  assert.deepEqual(loadShuyuan(), defaultShuyuan());
  backend.setItem(SHUYUAN_KEY, '{"styles":{"path":1}}');   // 舊版缺欄位
  const s = loadShuyuan();
  assert.deepEqual(s.styles, { path: 1 });
  assert.deepEqual(s.celebrated, []);                       // 缺欄位補齊
  setStorageBackend(null);
});

test('getGateStage 直讀 meta.xp.rank，越界夾回 0–9', () => {
  const m = defaultMeta();
  assert.deepEqual(getGateStage(m), { stage: 0, rankName: '蒙童', total: 10 });
  m.xp.rank = 6;
  assert.equal(getGateStage(m).stage, 6);
  assert.equal(getGateStage(m).rankName, '貢士');
  m.xp.rank = 99;
  assert.equal(getGateStage(m).stage, 9);
});

test('flourishTier 門檻 0/10/30/60/100', () => {
  assert.equal(flourishTier(0), 0);
  assert.equal(flourishTier(9), 0);
  assert.equal(flourishTier(10), 1);
  assert.equal(flourishTier(30), 2);
  assert.equal(flourishTier(60), 3);
  assert.equal(flourishTier(100), 4);
  assert.equal(FLOURISH_TIERS.length, 5);
});

test('getCourtyards 直讀 world byZone 進度並算繁茂度', () => {
  const m = defaultMeta();
  m.world.byZone = { yin: 15, xing: 0, chengyu: 435 };
  const totals = { yin: 150, xing: 100, chengyu: 435 };
  const cs = getCourtyards(m, totals);
  assert.equal(cs.length, 3);
  assert.deepEqual(cs.map((c) => c.name), ['谷音亭', '墨林軒', '珠璣閣']);
  assert.equal(cs[0].pct, 10);
  assert.equal(cs[0].tierName, '初萌');
  assert.equal(cs[1].tierName, '荒蕪');
  assert.equal(cs[2].pct, 100);
  assert.equal(cs[2].tierName, '鼎盛');
  assert.equal(COURTYARDS[0].zoneName, '字音谷');
});
