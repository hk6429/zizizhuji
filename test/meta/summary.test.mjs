import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  CHALLENGE_PREFIX, buildBattleSummary, buildPracticeSummary,
  makeChallengeCode, parseChallengeCode, compareChallenge, recordChallenge,
} from '../../js/meta/summary.js';

test('challenge code roundtrips UTF-8 payloads with ZZJ1. prefix', () => {
  const payload = {
    v: 1, name: '大乃小書生', questionIds: ['zy-103-001', 'cy-真-002'],
    correct: 8, timeMs: 95000, pearls: 12, date: '2026-07-14',
  };
  const code = makeChallengeCode(payload);
  assert.ok(code.startsWith(CHALLENGE_PREFIX));
  assert.ok(!/[+/=]/.test(code.slice(CHALLENGE_PREFIX.length))); // base64url
  assert.deepEqual(parseChallengeCode(code), payload);
});

test('parseChallengeCode rejects garbage', () => {
  assert.equal(parseChallengeCode('not-a-code'), null);
  assert.equal(parseChallengeCode('ZZJ1.!!!!'), null);
  assert.equal(parseChallengeCode(null), null);
  assert.equal(parseChallengeCode('ZZJ1.' + btoa('"just a string"')), null);
});

test('compareChallenge: correct first, then time; win pays ×0.5 bonus', () => {
  assert.deepEqual(
    compareChallenge({ correct: 9, timeMs: 100, pearls: 10 }, { correct: 8, timeMs: 50 }),
    { result: 'win', bonusPearls: 5 },
  );
  assert.equal(compareChallenge({ correct: 8, timeMs: 40, pearls: 9 }, { correct: 8, timeMs: 50 }).result, 'win');
  assert.equal(compareChallenge({ correct: 8, timeMs: 40, pearls: 9 }, { correct: 8, timeMs: 50 }).bonusPearls, 5); // ceil(4.5)
  assert.equal(compareChallenge({ correct: 7, timeMs: 40, pearls: 9 }, { correct: 8, timeMs: 50 }).result, 'lose');
  assert.deepEqual(
    compareChallenge({ correct: 8, timeMs: 50, pearls: 9 }, { correct: 8, timeMs: 50 }),
    { result: 'tie', bonusPearls: 0 },
  );
});

test('recordChallenge caps history at 30', () => {
  const meta = defaultMeta();
  for (let i = 0; i < 35; i++) recordChallenge(meta, { i });
  assert.equal(meta.challenges.length, 30);
  assert.equal(meta.challenges[0].i, 34); // 最新在前
});

test('buildBattleSummary aggregates session events into the card', () => {
  const meta = defaultMeta();
  meta.profile.name = '小書生';
  const events = [
    { type: 'pearlEarned', payload: { amount: 2 } },
    { type: 'pearlEarned', payload: { amount: 1 } },
    { type: 'xpGained', payload: { amount: 15 } },
    { type: 'purified', payload: { id: 'zy-1' } },
    { type: 'pearlForged', payload: { id: 'zy-1', gradeName: '金珠' } },
    { type: 'achievement', payload: { id: 'first-win', name: '初戰告捷' } },
  ];
  const card = buildBattleSummary({ won: true, correct: 9, total: 10, bestCombo: 6 }, events, meta);
  assert.equal(card.mode, 'battle');
  assert.equal(card.won, true);
  assert.equal(card.accuracy, 90);
  assert.equal(card.pearlsEarned, 3);
  assert.equal(card.xpGained, 15);
  assert.equal(card.newPearls.length, 1);
  assert.equal(card.newAchievements.length, 1);
  assert.equal(card.purifiedCount, 1);
  assert.equal(card.name, '小書生');
  assert.equal(card.rankName, '蒙童');
  assert.equal(typeof card.molingLine, 'string');
  assert.equal(card.goldFrame, false);
});

test('gold frame turns on at bond 100', () => {
  const meta = defaultMeta();
  meta.bond.value = 100;
  const card = buildBattleSummary({ won: false, correct: 3, total: 10, bestCombo: 1 }, [], meta);
  assert.equal(card.goldFrame, true);
});

test('buildPracticeSummary uses session stats', () => {
  const meta = defaultMeta();
  const card = buildPracticeSummary({ correct: 8, total: 10, bestCombo: 4, pearls: 11, xp: 90 }, meta);
  assert.equal(card.mode, 'practice');
  assert.equal(card.accuracy, 80);
  assert.equal(card.pearlsEarned, 11);
  assert.equal(card.xpGained, 90);
});
