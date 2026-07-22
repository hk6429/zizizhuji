import { test } from 'node:test';
import assert from 'node:assert/strict';
import { awardResultXp, resultXpBonus } from '../js/result-xp.js';
import { defaultMeta } from '../js/meta/store.js';

test('勝利或七成以上好成績，每答對一題結算約給一般文氣的一成', () => {
  assert.equal(resultXpBonus({ correct: 8, answered: 20, won: true }), 8);
  assert.equal(resultXpBonus({ correct: 7, answered: 10 }), 7);
  assert.equal(resultXpBonus({ correct: 6, answered: 10 }), 0);
  assert.equal(resultXpBonus({ correct: 9, answered: 10, won: false, requireWin: true }), 0);
});

test('前端結算會把獎勵寫進境界文氣', () => {
  const meta = defaultMeta();
  assert.equal(awardResultXp(meta, { correct: 8, answered: 10, won: true }), 8);
  assert.equal(meta.xp.value, 8);
});
