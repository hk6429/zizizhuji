import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  META_KEY, SCHEMA_VERSION, defaultMeta, loadMeta, saveMeta, resetAll, setStorageBackend,
} from '../../js/meta/store.js';

function createMockStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
    _map: map,
  };
}

let storage;
beforeEach(() => {
  storage = createMockStorage();
  setStorageBackend(storage);
});

test('META_KEY and SCHEMA_VERSION are stable constants', () => {
  assert.equal(META_KEY, 'zzj_meta');
  assert.equal(SCHEMA_VERSION, 1);
});

test('defaultMeta returns full shape with v = SCHEMA_VERSION', () => {
  const m = defaultMeta();
  assert.equal(m.v, SCHEMA_VERSION);
  for (const key of ['profile', 'oath', 'world', 'leitner', 'collection', 'pearls', 'xp',
    'ach', 'gear', 'arts', 'daily', 'bond', 'encounter', 'arena', 'challenges']) {
    assert.ok(key in m, `missing key ${key}`);
  }
  assert.equal(m.pearls.balance, 0);
  assert.deepEqual(m.challenges, []);
});

test('defaultMeta returns a fresh object every call (no shared reference)', () => {
  const a = defaultMeta();
  const b = defaultMeta();
  a.pearls.balance = 99;
  assert.equal(b.pearls.balance, 0);
});

test('loadMeta returns defaults when storage is empty', () => {
  assert.deepEqual(loadMeta(), defaultMeta());
});

test('saveMeta + loadMeta roundtrip', () => {
  const m = defaultMeta();
  m.pearls.balance = 42;
  m.world.purified.push('zy-103-001');
  assert.equal(saveMeta(m), true);
  const loaded = loadMeta();
  assert.equal(loaded.pearls.balance, 42);
  assert.deepEqual(loaded.world.purified, ['zy-103-001']);
});

test('loadMeta survives corrupted JSON and returns defaults', () => {
  storage.setItem(META_KEY, '{oops not json');
  assert.deepEqual(loadMeta(), defaultMeta());
});

test('loadMeta survives a throwing backend and returns defaults', () => {
  setStorageBackend({
    getItem() { throw new Error('private mode'); },
    setItem() { throw new Error('private mode'); },
    removeItem() { throw new Error('private mode'); },
  });
  assert.deepEqual(loadMeta(), defaultMeta());
  assert.equal(saveMeta(defaultMeta()), false); // does not throw
  resetAll(); // does not throw
});

test('loadMeta migrates partial/older data by filling missing keys', () => {
  storage.setItem(META_KEY, JSON.stringify({ pearls: { balance: 7 } }));
  const m = loadMeta();
  assert.equal(m.v, SCHEMA_VERSION);
  assert.equal(m.pearls.balance, 7);
  assert.equal(m.pearls.earnedToday, 0); // filled from defaults
  assert.deepEqual(m.gear.owned, []);
});

test('resetAll wipes the stored meta', () => {
  const m = defaultMeta();
  m.pearls.balance = 5;
  saveMeta(m);
  resetAll();
  assert.deepEqual(loadMeta(), defaultMeta());
});
