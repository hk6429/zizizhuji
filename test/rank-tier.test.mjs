import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rushRankName } from '../js/meta/rank-tier.js';

test('rushRankName 依門檻回傳對應段位', () => {
  assert.equal(rushRankName(0), '練字生');
  assert.equal(rushRankName(199), '練字生');
  assert.equal(rushRankName(200), '墨徒');
  assert.equal(rushRankName(499), '墨徒');
  assert.equal(rushRankName(500), '文膽');
  assert.equal(rushRankName(999), '文膽');
  assert.equal(rushRankName(1000), '珠璣手');
  assert.equal(rushRankName(1999), '珠璣手');
  assert.equal(rushRankName(2000), '墨界宗師');
  assert.equal(rushRankName(99999), '墨界宗師');
});
