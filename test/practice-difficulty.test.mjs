import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HARD_UNLOCK_MASTERY, practicePoolForPlayer } from '../js/practice-difficulty.js';

const bank = [
  { id: 'easy', difficulty: '易', question: '原題一', answer: '甲' },
  { id: 'medium', difficulty: '中', question: '原題二', answer: '乙', origin: 'competition' },
  { id: 'hard', difficulty: '難', question: '原題三', answer: '丙' },
];

test('未達精通門檻只抽易中題，達標後解鎖難題且不改題目內容', () => {
  const storage = { value: null, getItem() { return this.value; }, setItem(_key, value) { this.value = value; } };
  const novice = { collection: {} };
  const before = structuredClone(bank);
  assert.deepEqual(practicePoolForPlayer(bank, novice, storage).map((q) => q.id), ['easy', 'medium']);
  assert.deepEqual(bank, before, '篩選不得改動正式題目內容');

  const mastered = { collection: {} };
  for (let i = 0; i < HARD_UNLOCK_MASTERY; i++) mastered.collection[`zy-${i}`] = { earnedAt: 'now' };
  assert.deepEqual(practicePoolForPlayer(bank, mastered, storage).map((q) => q.id), ['easy', 'medium', 'hard']);
  assert.equal(storage.value, '1');
});
