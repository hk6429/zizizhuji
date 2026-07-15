import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getAchievementsOverview, ACHIEVEMENTS } from '../js/meta/achievements.js';

function makeMeta(stats, unlocked = {}) {
  return { ach: { stats, unlocked } };
}

test('getAchievementsOverview 標記已解鎖成就', () => {
  const meta = makeMeta({ wins: 1 }, { 'first-win': '2026-01-01T00:00:00Z' });
  const overview = getAchievementsOverview(meta);
  const firstWin = overview.find((a) => a.id === 'first-win');
  assert.equal(firstWin.unlocked, true);
  assert.equal(firstWin.unlockedAt, '2026-01-01T00:00:00Z');
  assert.equal(firstWin.name, ACHIEVEMENTS.find((a) => a.id === 'first-win').name);
});

test('隱藏且未解鎖的成就回傳佔位名稱、不洩漏進度', () => {
  const meta = makeMeta({ bestCombo: 2 });
  const overview = getAchievementsOverview(meta);
  const hidden = overview.find((a) => a.id === 'combo-10');
  assert.equal(hidden.unlocked, false);
  assert.equal(hidden.name, '未知成就');
  assert.equal(hidden.desc, '完成隱藏條件即可解鎖');
  assert.equal(hidden.progress, null);
});

test('進度數字與統計對應且不超過目標值', () => {
  const meta = makeMeta({ bestCombo: 4, forgedCount: 120, totalCorrect: 30 });
  const overview = getAchievementsOverview(meta);
  const combo5 = overview.find((a) => a.id === 'combo-5');
  assert.deepEqual(combo5.progress, { current: 4, target: 5 });
  const forge100 = overview.find((a) => a.id === 'forge-100');
  assert.deepEqual(forge100.progress, { current: 100, target: 100 }); // 超過目標時封頂
  const answered1000 = overview.find((a) => a.id === 'answered-1000');
  assert.deepEqual(answered1000.progress, { current: 30, target: 1000 });
});
