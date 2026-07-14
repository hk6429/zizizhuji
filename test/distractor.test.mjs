import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickCharDistractors, pickChengyuDistractors } from '../js/distractor.js';

test('pickCharDistractors returns n distinct distractors excluding the correct char', () => {
  const pool = ['滌', '條', '滌'.normalize(), '悌', '涤', '倜', '惕'];
  const result = pickCharDistractors('滌', pool, 3);
  assert.equal(result.length, 3);
  assert.ok(!result.includes('滌'));
  assert.equal(new Set(result).size, 3);
});

test('pickCharDistractors throws if pool has fewer than n eligible candidates', () => {
  assert.throws(() => pickCharDistractors('滌', ['滌'], 3), /not enough distractor candidates/);
});

test('pickChengyuDistractors excludes the correct phrase and dedupes', () => {
  const pool = ['一鳴驚人', '一鳴驚人', '一飛沖天', '一步登天', '一炮而紅', '一舉成名'];
  const result = pickChengyuDistractors('一鳴驚人', pool, 3);
  assert.equal(result.length, 3);
  assert.ok(!result.includes('一鳴驚人'));
});
