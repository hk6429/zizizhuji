import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import { ACHIEVEMENTS, recordStats, checkAchievements, unlock } from '../../js/meta/achievements.js';

function emptyStats() {
  return { wins: 0, battles: 0, bestCombo: 0, perfectGames: 0, totalAnswered: 0, totalCorrect: 0, lanternBest: 0 };
}

test('11 achievements, combo-10 is hidden with the 文曲星降臨 title', () => {
  assert.equal(ACHIEVEMENTS.length, 11);
  const hidden = ACHIEVEMENTS.find(a => a.id === 'combo-10');
  assert.equal(hidden.hidden, true);
  assert.equal(hidden.title, '文曲星降臨');
});

test('checkAchievements is pure and threshold-exact', () => {
  assert.deepEqual(checkAchievements(emptyStats()), []);
  const s = { ...emptyStats(), wins: 1, bestCombo: 5 };
  const ids = checkAchievements(s);
  assert.ok(ids.includes('first-win'));
  assert.ok(ids.includes('combo-3'));
  assert.ok(ids.includes('combo-5'));
  assert.ok(!ids.includes('combo-10'));
  assert.ok(!ids.includes('moling-bane'));
});

test('recordStats: counters add, bestCombo/lanternBest take max', () => {
  const meta = defaultMeta();
  recordStats(meta, { wins: 1, battles: 1, bestCombo: 4 });
  recordStats(meta, { wins: 1, battles: 1, bestCombo: 2 });
  assert.equal(meta.ach.stats.wins, 2);
  assert.equal(meta.ach.stats.battles, 2);
  assert.equal(meta.ach.stats.bestCombo, 4); // max, not sum
});

test('unlock records ISO timestamp and is idempotent', () => {
  const meta = defaultMeta();
  let r = unlock(meta, ['first-win', 'combo-3']);
  assert.equal(r.newlyUnlocked.length, 2);
  assert.ok(meta.ach.unlocked['first-win'].includes('T')); // ISO string
  r = unlock(meta, ['first-win']);
  assert.equal(r.newlyUnlocked.length, 0);
  r = unlock(meta, ['no-such-achievement']);
  assert.equal(r.newlyUnlocked.length, 0);
});
