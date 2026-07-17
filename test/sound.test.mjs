import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSoundOn, setSoundOn, playCorrect, playWrong, playCombo, playLevelUp } from '../js/sound.js';

function withStorage(fn) {
  const prev = globalThis.localStorage;
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  try { fn(); } finally {
    if (prev === undefined) delete globalThis.localStorage; else globalThis.localStorage = prev;
  }
}

test('音效預設開啟，setSoundOn 可切換並持久化', () => {
  withStorage(() => {
    assert.equal(isSoundOn(), true);
    setSoundOn(false);
    assert.equal(isSoundOn(), false);
    setSoundOn(true);
    assert.equal(isSoundOn(), true);
  });
});

test('沒有 localStorage（隱私模式）時 isSoundOn 安全回傳預設值，不拋錯', () => {
  const prev = globalThis.localStorage;
  delete globalThis.localStorage;
  try {
    assert.equal(isSoundOn(), true);
  } finally {
    if (prev !== undefined) globalThis.localStorage = prev;
  }
});

test('無瀏覽器環境（無 window）呼叫播放函式不拋錯，靜默 no-op', () => {
  assert.doesNotThrow(() => {
    playCorrect();
    playWrong();
    playCombo();
    playLevelUp();
  });
});
