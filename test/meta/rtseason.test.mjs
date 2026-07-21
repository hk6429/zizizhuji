import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  seasonKey, titleFor, loadSeason, recordResult, WIN_PTS, LOSE_PTS,
  LOSE_ACCURACY_THRESHOLD, LOSE_PTS_MIN, loadSoloBest, saveSoloBestIfHigher,
} from '../../js/meta/rtseason.js';

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

test('titleFor：門檻邊界（純看分數，勝率 0 時只能拿到無勝率要求的低三階）', () => {
  assert.equal(titleFor(0), '白衣書生');
  assert.equal(titleFor(59), '白衣書生');
  assert.equal(titleFor(60), '青衿學子');
  assert.equal(titleFor(160), '墨林秀才');
  assert.equal(titleFor(320), '墨林秀才'); // 勝率 0 < 0.3 門檻，卡在秀才拿不到舉人
  assert.equal(titleFor(880), '墨林秀才'); // 同上，分數再高也一樣被勝率卡住
});

test('titleFor：勝率達門檻才能拿高三階稱號，避免純時間堆頭銜', () => {
  assert.equal(titleFor(320, 2, 10), '墨林秀才'); // 勝率 20% < 30% 門檻，卡關
  assert.equal(titleFor(320, 3, 10), '珠璣舉人'); // 勝率 30%，達標
  assert.equal(titleFor(560, 3, 10), '珠璣舉人'); // 勝率 30% 夠舉人(需30%)但不夠進士(需 40%)
  assert.equal(titleFor(560, 40, 100), '翰墨進士'); // 勝率 40%，達標
  assert.equal(titleFor(880, 40, 100), '翰墨進士'); // 勝率 40% 不夠魁星(需 50%)
  assert.equal(titleFor(880, 5, 10), '文曲魁星'); // 勝率 50%，達標
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

test('recordResult：答對率低於門檻時安慰分打折（擋純掛機／亂點刷分），不影響及格的認真作答', () => {
  store.clear();
  // 答對率 0（純掛機）：只拿 LOSE_PTS_MIN
  let r = recordResult('2026-07-20', 'lose', 0);
  assert.equal(r.pts, LOSE_PTS_MIN);
  store.clear();
  // 答對率剛好等於門檻：視為達標，拿滿額安慰分（門檻用 < 判斷，等於不算沒達標）
  r = recordResult('2026-07-20', 'lose', LOSE_ACCURACY_THRESHOLD);
  assert.equal(r.pts, LOSE_PTS);
  store.clear();
  // 答對率略低於門檻：打折
  r = recordResult('2026-07-20', 'lose', LOSE_ACCURACY_THRESHOLD - 0.01);
  assert.equal(r.pts, LOSE_PTS_MIN);
  store.clear();
  // 認真作答答對率高但打輸：仍拿滿額安慰分，不懲罰
  r = recordResult('2026-07-20', 'lose', 0.9);
  assert.equal(r.pts, LOSE_PTS);
  store.clear();
  // 贏永遠是 WIN_PTS，跟答對率無關
  r = recordResult('2026-07-20', 'win', 0);
  assert.equal(r.pts, WIN_PTS);
});

test('recordResult：未提供 correctRate 時向下相容（視同全對，不打折）', () => {
  store.clear();
  const r = recordResult('2026-07-20', 'lose');
  assert.equal(r.pts, LOSE_PTS);
});

test('單人刺客歷史最佳紀錄：只在打破紀錄時更新，且不會倒扣', () => {
  store.clear();
  assert.equal(loadSoloBest(), 0);
  let r = saveSoloBestIfHigher(120);
  assert.deepEqual(r, { best: 120, isNew: true });
  assert.equal(loadSoloBest(), 120);
  r = saveSoloBestIfHigher(90); // 沒破紀錄，維持原值
  assert.deepEqual(r, { best: 120, isNew: false });
  assert.equal(loadSoloBest(), 120);
  r = saveSoloBestIfHigher(150); // 破紀錄
  assert.deepEqual(r, { best: 150, isNew: true });
  assert.equal(loadSoloBest(), 150);
});
