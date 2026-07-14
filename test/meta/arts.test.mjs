import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  ARTS, INK_MAX, MAX_CASTS, syncUnlocks, equipArt, createArtSession, gainInk, castArt,
} from '../../js/meta/arts.js';

test('three arts unlock at 5/15/30 wins', () => {
  assert.deepEqual(ARTS.map(a => a.unlockWins), [5, 15, 30]);
});

test('syncUnlocks unlocks by battlesWon and reports newly unlocked once', () => {
  const meta = defaultMeta();
  assert.deepEqual(syncUnlocks(meta).newlyUnlocked, []);
  meta.arts.battlesWon = 5;
  let r = syncUnlocks(meta);
  assert.deepEqual(r.newlyUnlocked.map(a => a.id), ['dianjing']);
  r = syncUnlocks(meta); // 冪等
  assert.deepEqual(r.newlyUnlocked, []);
  meta.arts.battlesWon = 30;
  r = syncUnlocks(meta);
  assert.deepEqual(r.newlyUnlocked.map(a => a.id), ['pomo', 'shouxin']);
});

test('equipArt requires unlock; null unequips', () => {
  const meta = defaultMeta();
  assert.equal(equipArt(meta, 'dianjing').ok, false);
  meta.arts.battlesWon = 5;
  syncUnlocks(meta);
  assert.equal(equipArt(meta, 'dianjing').ok, true);
  assert.equal(meta.arts.equipped, 'dianjing');
  assert.equal(equipArt(meta, null).ok, true);
  assert.equal(meta.arts.equipped, null);
});

test('ink gauge: +1 per correct, inkBonus adds, caps at 5', () => {
  const meta = defaultMeta();
  meta.arts.battlesWon = 5;
  syncUnlocks(meta);
  equipArt(meta, 'dianjing');
  let s = createArtSession(meta);
  assert.equal(s.ink, 0);
  s = gainInk(s);
  assert.equal(s.ink, 1);
  s = gainInk(s, 1); // 洮硯
  assert.equal(s.ink, 3);
  s = gainInk(s, 1);
  s = gainInk(s, 1);
  assert.equal(s.ink, INK_MAX); // capped
});

test('castArt needs full ink, resets gauge, max 3 casts per battle', () => {
  const meta = defaultMeta();
  meta.arts.battlesWon = 15;
  syncUnlocks(meta);
  equipArt(meta, 'pomo');
  let s = createArtSession(meta);
  assert.equal(castArt(s).ok, false); // 沒氣
  for (let i = 0; i < 5; i++) s = gainInk(s);
  let r = castArt(s);
  assert.equal(r.effect.type, 'doubleDamage');
  assert.equal(r.session.ink, 0);
  assert.equal(r.session.casts, 1);
  // 用滿 3 次後鎖住
  s = { ...r.session, ink: 5, casts: MAX_CASTS };
  assert.equal(castArt(s).ok, false);
});

test('castArt without an equipped art fails', () => {
  const s = { artId: null, ink: 5, casts: 0 };
  assert.equal(castArt(s).ok, false);
});
