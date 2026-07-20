// 即時對戰必須關掉 kernel 本機隨機奇遇（ctx.encounterOff），否則雙方事件不同步（Task 7 用種子化奇遇取代）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setStorageBackend } from '../../js/meta/store.js';
import * as kernel from '../../js/meta/kernel.js';
import { createBattleStateEx } from '../../js/meta/battle-adapter.js';

function createMockStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('ctx.encounterOff = true 時，onBattleAnswer 絕不產生 encounter 事件', () => {
  setStorageBackend(createMockStorage());
  const { ctx } = kernel.initSession('2026-07-20', { ziyin: [], chengyu: [] }, { rng: () => 0 }); // rng()=0 → 每題必觸發奇遇
  ctx.encounterOff = true;
  // onBattleAnswer 第一次呼叫會自建 ctx.battle；先手動觸發一次取 state
  let state = kernel.onBattleAnswer(ctx, { hpA: 100, hpB: 100, comboA: 0, comboB: 0 }, 'A', true).state;
  state = createBattleStateEx(ctx.battle);
  for (let i = 0; i < 15; i++) {
    const r = kernel.onBattleAnswer(ctx, state, 'A', true);
    state = r.state;
    assert.ok(r.events.every((e) => e.type !== 'encounter'), '不可出現 encounter 事件');
  }
});
