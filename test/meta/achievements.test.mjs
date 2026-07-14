import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import { ACHIEVEMENTS, recordStats, checkAchievements, unlock } from '../../js/meta/achievements.js';

function emptyStats() {
  return {
    wins: 0, battles: 0, bestCombo: 0, perfectGames: 0, totalAnswered: 0, totalCorrect: 0, lanternBest: 0,
    forgedCount: 0, forgedZiyin: 0, forgedChengyu: 0,
  };
}

test('17 achievements, combo-10 is hidden with the 文曲星降臨 title', () => {
  assert.equal(ACHIEVEMENTS.length, 17);
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

test('M3 collection milestones: total-count badges are threshold-exact', () => {
  assert.deepEqual(checkAchievements({ ...emptyStats(), forgedCount: 9 }).filter(id => id.startsWith('forge-')), []);
  const at10 = checkAchievements({ ...emptyStats(), forgedCount: 10 });
  assert.ok(at10.includes('forge-10')); // 初綴
  assert.ok(!at10.includes('forge-50'));
  const at100 = checkAchievements({ ...emptyStats(), forgedCount: 100 });
  assert.ok(at100.includes('forge-10'));
  assert.ok(at100.includes('forge-50')); // 串珠
  assert.ok(at100.includes('forge-100')); // 珠簾
  assert.ok(!at100.includes('forge-685'));
  const grand = checkAchievements({ ...emptyStats(), forgedCount: 685 });
  assert.ok(grand.includes('forge-685')); // 字字珠璣・大成
});

test('M3 collection milestones: domain 圓滿 badges use per-domain forged counts', () => {
  const zy = checkAchievements({ ...emptyStats(), forgedCount: 250, forgedZiyin: 250 });
  assert.ok(zy.includes('forge-ziyin-250')); // 字音圓滿
  assert.ok(!zy.includes('forge-chengyu-435'));
  const cy = checkAchievements({ ...emptyStats(), forgedCount: 435, forgedChengyu: 435 });
  assert.ok(cy.includes('forge-chengyu-435')); // 成語圓滿
  assert.ok(!cy.includes('forge-ziyin-250'));
  // 全靠總數不夠：域內數不足時圓滿不解鎖
  const mixed = checkAchievements({ ...emptyStats(), forgedCount: 400, forgedZiyin: 200, forgedChengyu: 200 });
  assert.ok(!mixed.includes('forge-ziyin-250'));
  assert.ok(!mixed.includes('forge-chengyu-435'));
});

test('milestone badge names follow the design doc (初綴/串珠/珠簾/圓滿/大成)', () => {
  const names = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a.name]));
  assert.equal(names['forge-10'], '初綴');
  assert.equal(names['forge-50'], '串珠');
  assert.equal(names['forge-100'], '珠簾');
  assert.equal(names['forge-ziyin-250'], '字音圓滿');
  assert.equal(names['forge-chengyu-435'], '成語圓滿');
  assert.equal(names['forge-685'], '字字珠璣・大成');
});

test('recordStats: forged counters are additive per domain', () => {
  const meta = defaultMeta();
  recordStats(meta, { forgedCount: 1, forgedZiyin: 1, forgedChengyu: 0 });
  recordStats(meta, { forgedCount: 1, forgedZiyin: 0, forgedChengyu: 1 });
  assert.equal(meta.ach.stats.forgedCount, 2);
  assert.equal(meta.ach.stats.forgedZiyin, 1);
  assert.equal(meta.ach.stats.forgedChengyu, 1);
});

test('defaultMeta ships forged counters so old saves migrate to 0', () => {
  const s = defaultMeta().ach.stats;
  assert.equal(s.forgedCount, 0);
  assert.equal(s.forgedZiyin, 0);
  assert.equal(s.forgedChengyu, 0);
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
