import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { setStorageBackend } from '../js/meta/store.js';
import { initSession, onPracticeAnswer } from '../js/meta/kernel.js';
import { getCollection, getMasteryStats } from '../js/meta/collection.js';
import { listPets } from '../js/meta/pet.js';
import { createLearningScheduler } from '../js/learning-group.js';
import { nextQuestionId } from '../js/leitner.js';

const ziyin = JSON.parse(fs.readFileSync('data/ziyin-zixing-elementary.json', 'utf8'));
const chengyu = JSON.parse(fs.readFileSync('data/chengyu-elementary.json', 'utf8'));

test('既有 420 題進度接上學習組後，可在合理題量內煉成字珠並解鎖新寵物', () => {
  const storage = new Map();
  setStorageBackend({
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key),
  });
  const { ctx } = initSession('2026-07-24', { ziyin, chengyu }, { rng: () => 1 });
  const oldProgress = ziyin.slice(0, 420);

  for (const entry of oldProgress) onPracticeAnswer(ctx, entry.id, true);
  assert.equal(getMasteryStats(ctx.meta, ziyin).known, 0);
  assert.equal(getCollection(ctx.meta).earned.length, 0);

  const ids = ziyin.map((entry) => entry.id);
  const byId = new Map(ziyin.map((entry) => [entry.id, entry]));
  const scheduler = createLearningScheduler(ids, ctx.leitner, {
    size: 20,
    shuffle: (items) => items,
  });
  const pick = (candidates) => nextQuestionId(ctx.leitner, candidates, byId);

  for (let answered = 0; answered < 45; answered += 1) {
    const { id } = scheduler.next(pick);
    onPracticeAnswer(ctx, id, true);
    scheduler.record(id, true);
  }

  assert.ok(getMasteryStats(ctx.meta, ziyin).known >= 5);
  assert.ok(getCollection(ctx.meta).earned.length >= 5);
  assert.ok(listPets(ctx.meta).filter((pet) => pet.unlocked).length >= 4);
});
