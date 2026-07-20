import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHUYUAN_KEY, setStorageBackend, defaultShuyuan, loadShuyuan, saveShuyuan,
} from '../js/meta/shuyuan-store.js';

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
