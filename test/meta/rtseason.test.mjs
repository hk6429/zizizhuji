import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonKey, titleFor, loadSeason, recordResult, WIN_PTS, LOSE_PTS } from '../../js/meta/rtseason.js';

// 注入假 localStorage（node 環境沒有 window）
const store = new Map();
globalThis.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: k => store.delete(k),
};

test('seasonKey：月賽季', () => {
  assert.equal(seasonKey('2026-07-20'), '2026-07');
  assert.equal(seasonKey('2026-12-01'), '2026-12');
});

test('titleFor：門檻邊界', () => {
  assert.equal(titleFor(0), '白衣書生');
  assert.equal(titleFor(59), '白衣書生');
  assert.equal(titleFor(60), '青衿學子');
  assert.equal(titleFor(880), '文曲魁星');
  assert.equal(titleFor(99999), '文曲魁星');
});

test('recordResult：勝 +20、敗 +5（不倒扣）、平手 +5；跨季歸零', () => {
  store.clear();
  let r = recordResult('2026-07-20', 'win');
  assert.deepEqual([r.pts, r.wins, r.battles], [WIN_PTS, 1, 1]);
  r = recordResult('2026-07-21', 'lose');
  assert.deepEqual([r.pts, r.wins, r.battles], [WIN_PTS + LOSE_PTS, 1, 2]);
  r = recordResult('2026-08-01', 'draw');   // 換季
  assert.deepEqual([r.key, r.pts, r.battles], ['2026-08', LOSE_PTS, 1]);
});
