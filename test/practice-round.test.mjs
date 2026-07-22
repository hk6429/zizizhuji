import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRoundState, nextInRound, recordRound, advanceRound,
} from '../js/practice-round.js';

// 依序取用時，pickFn 就挑候選第一個（模擬確定性排序）
const first = (cands) => cands[0];

test('一輪內每題各出一次，不重複；出完回傳 null', () => {
  const rs = createRoundState(['a', 'b', 'c']);
  const got = [];
  let id;
  while ((id = nextInRound(rs, first)) !== null) got.push(id);
  assert.deepEqual(got.sort(), ['a', 'b', 'c']);
  assert.equal(nextInRound(rs, first), null);
});

test('本輪有錯題 → 下一輪只複習錯題', () => {
  const rs = createRoundState(['a', 'b', 'c']);
  recordRound(rs, nextInRound(rs, first), true);   // a 對
  recordRound(rs, nextInRound(rs, first), false);  // b 錯
  recordRound(rs, nextInRound(rs, first), false);  // c 錯
  assert.equal(nextInRound(rs, first), null);      // 本輪出完
  const info = advanceRound(rs, ['a', 'b', 'c'], null);
  assert.equal(info.mode, 'wrong-review');
  assert.equal(info.size, 2);
  const review = [];
  let id;
  while ((id = nextInRound(rs, first)) !== null) review.push(id);
  assert.deepEqual(review.sort(), ['b', 'c']); // 只複習錯的兩題
});

test('複習輪答對的題會從錯題集移除，全對後轉重洗整池', () => {
  const rs = createRoundState(['a', 'b']);
  recordRound(rs, nextInRound(rs, first), false); // a 錯
  recordRound(rs, nextInRound(rs, first), false); // b 錯
  nextInRound(rs, first);                          // null，本輪完
  advanceRound(rs, ['a', 'b'], null);             // 進複習輪 [a,b]
  recordRound(rs, nextInRound(rs, first), true);  // a 對
  recordRound(rs, nextInRound(rs, first), true);  // b 對
  nextInRound(rs, first);                          // null
  const info = advanceRound(rs, ['a', 'b'], null);
  assert.equal(info.mode, 'fresh');
  assert.equal(info.size, 2);
  assert.equal(rs.round, 3);
});

test('全對一輪直接重洗整池（fresh），並套用 shuffleFn', () => {
  const rs = createRoundState(['a', 'b', 'c']);
  for (let i = 0; i < 3; i++) recordRound(rs, nextInRound(rs, first), true);
  assert.equal(nextInRound(rs, first), null);
  const info = advanceRound(rs, ['a', 'b', 'c'], (arr) => arr.slice().reverse());
  assert.equal(info.mode, 'fresh');
  assert.deepEqual(rs.pool, ['c', 'b', 'a']);
  assert.equal(rs.served.size, 0);
});
