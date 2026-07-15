import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getMostWrong } from '../js/meta/collection.js';

function meta(collection) { return { collection }; }

test('getMostWrong 依答錯次數由多到少排序', () => {
  const bank = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const m = meta({
    a: { wrong: 1 },
    b: { wrong: 5 },
    c: { wrong: 3 },
  });
  const result = getMostWrong(m, bank);
  assert.deepEqual(result.map((r) => r.id), ['b', 'c', 'a']);
});

test('getMostWrong 排除從未答錯的題目', () => {
  const bank = [{ id: 'a' }, { id: 'b' }];
  const m = meta({ a: { wrong: 0 }, b: { wrong: 2 } });
  const result = getMostWrong(m, bank);
  assert.deepEqual(result.map((r) => r.id), ['b']);
});

test('getMostWrong 尊重 n 上限', () => {
  const bank = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const m = meta({ a: { wrong: 1 }, b: { wrong: 2 }, c: { wrong: 3 } });
  const result = getMostWrong(m, bank, 2);
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((r) => r.id), ['c', 'b']);
});

test('getMostWrong 過濾掉不在題庫內的紀錄', () => {
  const bank = [{ id: 'a' }];
  const m = meta({ a: { wrong: 1 }, ghost: { wrong: 99 } });
  const result = getMostWrong(m, bank);
  assert.deepEqual(result.map((r) => r.id), ['a']);
});
