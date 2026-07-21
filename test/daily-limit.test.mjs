import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

function createMockStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

let mod;

beforeEach(async () => {
  globalThis.localStorage = createMockStorage();
  // 每個測試重新載入模組，重置 bypassLimitOnce 的記憶體旗標
  mod = await import(`../js/daily-limit.js?t=${Math.random()}`);
});

test('getDailyLimit 預設不限制（空字串/未設定）', () => {
  assert.equal(mod.getDailyLimit(), 0);
});

test('setDailyLimit 寫入正整數，getDailyLimit 讀回相同值', () => {
  mod.setDailyLimit(20);
  assert.equal(mod.getDailyLimit(), 20);
});

test('setDailyLimit(0) 或負數視同不限制', () => {
  mod.setDailyLimit(20);
  mod.setDailyLimit(0);
  assert.equal(mod.getDailyLimit(), 0);
});

test('isDailyLimitReached：未設限制一律 false', () => {
  assert.equal(mod.isDailyLimitReached({ daily: { todayAnswered: 999 } }), false);
});

test('isDailyLimitReached：邊界值——剛好等於上限才算達標', () => {
  mod.setDailyLimit(10);
  assert.equal(mod.isDailyLimitReached({ daily: { todayAnswered: 9 } }), false);
  assert.equal(mod.isDailyLimitReached({ daily: { todayAnswered: 10 } }), true);
  assert.equal(mod.isDailyLimitReached({ daily: { todayAnswered: 11 } }), true);
});

test('bypassLimitOnce 讓當次 session 忽略限制', () => {
  mod.setDailyLimit(5);
  assert.equal(mod.isDailyLimitReached({ daily: { todayAnswered: 5 } }), true);
  mod.bypassLimitOnce();
  assert.equal(mod.isDailyLimitReached({ daily: { todayAnswered: 100 } }), false);
});

test('家長通行碼：預設未設，hasDailyPin=false、checkDailyPin 一律放行', () => {
  assert.equal(mod.hasDailyPin(), false);
  assert.equal(mod.getDailyPin(), '');
  assert.equal(mod.checkDailyPin(''), true);
  assert.equal(mod.checkDailyPin('1234'), true);
});

test('家長通行碼：設定後只有正確碼放行', () => {
  mod.setDailyPin('2468');
  assert.equal(mod.hasDailyPin(), true);
  assert.equal(mod.checkDailyPin('2468'), true);
  assert.equal(mod.checkDailyPin('0000'), false);
  assert.equal(mod.checkDailyPin(''), false);
});

test('家長通行碼：前後空白會被 trim，空字串＝清除', () => {
  mod.setDailyPin('  99  ');
  assert.equal(mod.getDailyPin(), '99');
  assert.equal(mod.checkDailyPin('99'), true);
  mod.setDailyPin('');
  assert.equal(mod.hasDailyPin(), false);
});
