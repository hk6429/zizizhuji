import { test } from 'node:test';
import assert from 'node:assert/strict';
import { revealAdvancedPlayOnce } from '../js/advanced-play.js';

test('首次達成練習節點會自動展開進階玩法且只記錄一次', () => {
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const details = { open: false };
  assert.equal(revealAdvancedPlayOnce(details, storage), true);
  assert.equal(details.open, true);
  details.open = false;
  assert.equal(revealAdvancedPlayOnce(details, storage), false);
  assert.equal(details.open, false);
});
