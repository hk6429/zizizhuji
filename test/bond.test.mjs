import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES } from '../js/meta/bond.js';

test('每個階段每種情境至少有 3 句台詞可輪替', () => {
  const situations = ['open', 'correct', 'combo3', 'wrong', 'win', 'lose'];
  for (let stage = 0; stage < LINES.length; stage++) {
    for (const situation of situations) {
      const pool = LINES[stage][situation];
      assert.ok(Array.isArray(pool), `stage ${stage} 缺少 ${situation}`);
      assert.ok(pool.length >= 3, `stage ${stage} 的 ${situation} 只有 ${pool.length} 句`);
    }
  }
});
