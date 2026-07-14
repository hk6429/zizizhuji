import { test } from 'node:test';
import assert from 'node:assert';
import { canConnect, tilesMatch, buildLayout, countRemaining, hasMoves } from '../../js/selfstudy/link.js';

// 以字串盤面建 grid：非空白字元＝一張以自身為 key 的牌，空白＝null。
function mk(rows) {
  return rows.map((row) => [...row].map((ch) => (ch === '.' ? null : { key: ch })));
}

test('tilesMatch：同 key 不同物件才算對', () => {
  const a = { key: 'p0' }, b = { key: 'p0' }, c = { key: 'p1' };
  assert.equal(tilesMatch(a, b), true);
  assert.equal(tilesMatch(a, a), false);
  assert.equal(tilesMatch(a, c), false);
});

test('0 轉折：同列相鄰可連', () => {
  const g = mk(['AA']);
  assert.equal(canConnect(g, [0, 0], [0, 1]), true);
});

test('直線被擋、且四周堵死無法繞（不可連）', () => {
  // 兩張牌在盤內、中間有 X，上下也都是 X，無界外可繞
  const g = mk([
    'XXXXX',
    'XAXAX',
    'XXXXX',
  ]);
  assert.equal(canConnect(g, [1, 1], [1, 3]), false);
});

test('1 轉折：轉角為空可連', () => {
  const g = mk([
    'A.',
    '.A',
  ]);
  assert.equal(canConnect(g, [0, 0], [1, 1]), true);
});

test('2 轉折：繞界外空邊可連', () => {
  // 兩張牌被夾在角落，只能繞外圈
  const g = mk([
    'A.B'.replace('B', 'A'), // 'A.A'
  ]);
  assert.equal(canConnect(g, [0, 0], [0, 2]), true); // 中間空 → 其實 0 轉折
  const g2 = mk([
    'AXA',
    '...',
  ]);
  // 上排被 X 擋，往下繞一圈（2 轉折）
  assert.equal(canConnect(g2, [0, 0], [0, 2]), true);
});

test('完全被包圍不可連', () => {
  const g = mk([
    'XXX',
    'XAX',
    'XXX',
  ]);
  // 目標另一張放界外不可能；這裡驗證被四面堵死的牌連不到相鄰
  const g2 = mk([
    'AX',
    'XA',
  ]);
  assert.equal(canConnect(g2, [0, 0], [1, 1]), false);
});

test('buildLayout 鋪滿盤面、每組兩張', () => {
  const pairs = [{ char: '拓', zhuyin: 'ㄊㄚˋ', id: 'a' }, { char: '鐫', zhuyin: 'ㄐㄩㄢ', id: 'b' }];
  const grid = buildLayout(pairs, 2, 2);
  assert.equal(countRemaining(grid), 4);
  const keys = grid.flat().map((t) => t.key).sort();
  assert.deepEqual(keys, ['p0', 'p0', 'p1', 'p1']);
});

test('hasMoves：有相鄰可消對 true，空盤 false', () => {
  const a = { key: 'p0' }, b = { key: 'p0' };
  assert.equal(hasMoves([[a, b]]), true);       // 相鄰同組可消
  assert.equal(hasMoves(mk(['..', '..'])), false); // 空盤無步
});

test('buildLayout 產出的盤面偶爾會死局（UI 需重洗保證可解）', () => {
  // 純提示性：packed 小盤可能無步，故 link-ui 會 hasMoves 檢查後重洗
  const pairs = [{ char: '拓', zhuyin: 'ㄊㄚˋ', id: 'a' }, { char: '鐫', zhuyin: 'ㄐㄩㄢ', id: 'b' }];
  const grid = buildLayout(pairs, 2, 2);
  assert.equal(countRemaining(grid), 4); // 只驗鋪滿；可解性由 UI 重洗保證
});
