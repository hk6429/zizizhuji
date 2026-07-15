import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildHotseatShareText } from '../js/meta/summary.js';

function player(name, score, correct, answered) {
  return { name, score: { score, correct, answered } };
}

test('buildHotseatShareText 產生獲勝戰報並包含兩人姓名與分數', () => {
  const text = buildHotseatShareText([player('玩家一', 60, 6, 10), player('玩家二', 90, 9, 10)]);
  assert.match(text, /玩家二 90 : 玩家一 60，玩家二 獲勝！/);
  assert.match(text, /玩家二 9\/10/);
  assert.match(text, /玩家一 6\/10/);
});

test('buildHotseatShareText 同分時輸出平手', () => {
  const text = buildHotseatShareText([player('玩家一', 50, 5, 10), player('玩家二', 50, 5, 10)]);
  assert.match(text, /平手！/);
});
