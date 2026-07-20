import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEAR_WHITELIST, tierOf, validPrice, isMarketOpen, weekKey, okNick, okClass, sigOf, PRICE_BAND } from '../functions/api/market.js';
import { GEAR_LIST } from '../js/meta/gear.js';

test('GEAR_WHITELIST 與前端 GEAR_LIST 完全同步（防雙表漂移）', () => {
  assert.equal(Object.keys(GEAR_WHITELIST).length, 12);
  for (const g of GEAR_LIST) assert.equal(GEAR_WHITELIST[g.id], g.price);
});
test('tierOf：80→fan、150→liang、300→zhen；神獸/未知 id 一律 null', () => {
  assert.equal(tierOf('langhao'), 'fan');
  assert.equal(tierOf('duanyan'), 'liang');
  assert.equal(tierOf('sheyan'), 'zhen');
  assert.equal(tierOf('qilin'), null);      // 神獸 id 不在白名單
  assert.equal(tierOf(''), null);
  assert.equal(tierOf(null), null);
});
test('validPrice：整數且落在該階價格帶', () => {
  assert.equal(validPrice('langhao', 40), true);   // fan 下界
  assert.equal(validPrice('langhao', 120), true);  // fan 上界
  assert.equal(validPrice('langhao', 39), false);
  assert.equal(validPrice('langhao', 121), false);
  assert.equal(validPrice('langhao', 50.5), false);
  assert.equal(validPrice('sheyan', 450), true);   // zhen 上界
  assert.equal(validPrice('nope', 100), false);
});
test('isMarketOpen：UTC+8 週五16:00 起、週日24:00 止', () => {
  // 2026-07-24 是週五。UTC+8 15:59 = UTC 07:59
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 24, 7, 59)), false);
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 24, 8, 0)), true);   // 週五 16:00
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 25, 4, 0)), true);   // 週六中午
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 26, 15, 59)), true); // 週日 23:59
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 26, 16, 0)), false); // 週一 00:00
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 22, 4, 0)), false);  // 週三
});
test('weekKey：同一開市週末（五六日）落同桶、跨週不同桶', () => {
  assert.equal(weekKey(Date.UTC(2026, 6, 24, 9, 0)), weekKey(Date.UTC(2026, 6, 26, 12, 0)));
  assert.notEqual(weekKey(Date.UTC(2026, 6, 24, 9, 0)), weekKey(Date.UTC(2026, 6, 31, 9, 0)));
});
test('okNick：長度、危險字元、髒話全擋', () => {
  assert.equal(okNick('小明'), true);
  assert.equal(okNick(''), false);
  assert.equal(okNick('a'.repeat(13)), false);
  assert.equal(okNick('<img>'), false);
  assert.equal(okNick('笨蛋'), false);
});
test('okClass：合法班碼放行、注入字元擋下', () => {
  assert.equal(okClass('七年3班'), true);
  assert.equal(okClass('demo'), true);
  assert.equal(okClass('a;DROP'), false);
  assert.equal(okClass(''), false);
});
test('sigOf：同 payload 同 secret 穩定；欄位變動即不同', () => {
  const p = { gearId: 'langhao', price: 50, seller: '小明', id: 'abc123' };
  assert.equal(sigOf(p, 's1'), sigOf({ ...p }, 's1'));
  assert.equal(sigOf(p, 's1').length, 24);
  assert.notEqual(sigOf(p, 's1'), sigOf({ ...p, price: 51 }, 's1'));
  assert.notEqual(sigOf(p, 's1'), sigOf(p, 's2'));
});
