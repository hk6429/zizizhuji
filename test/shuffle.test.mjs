import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shuffle } from '../js/shuffle.js';

test('shuffle returns a new array with the same elements', () => {
  const original = [1, 2, 3, 4, 5];
  const result = shuffle(original);
  assert.notEqual(result, original);
  assert.deepEqual([...result].sort(), original);
});

test('shuffle does not mutate the input array', () => {
  const original = [1, 2, 3, 4, 5];
  const snapshot = [...original];
  shuffle(original);
  assert.deepEqual(original, snapshot);
});

test('shuffle handles empty and single-element arrays', () => {
  assert.deepEqual(shuffle([]), []);
  assert.deepEqual(shuffle([1]), [1]);
});
