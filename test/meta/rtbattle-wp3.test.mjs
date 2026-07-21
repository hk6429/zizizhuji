// WP3 新增測試：單人刺客決定性種子/防線分數、即時對戰事件權重校準。
// 獨立新檔，避免動到既有 test/meta/rtbattle.test.mjs 的既有斷言。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assassinSeed, assassinTargetScore, ASSASSIN_BASE, ASSASSIN_SPAN, buildEncounterScript,
} from '../../js/meta/rtbattle.js';

test('assassinSeed：同一天任何時候算出同一個種子（不可依賴 Date.now/Math.random）', () => {
  assert.equal(assassinSeed('2026-07-20'), assassinSeed('2026-07-20'));
  assert.notEqual(assassinSeed('2026-07-20'), assassinSeed('2026-07-21'));
});

test('assassinTargetScore：同一天防線分數固定、落在合理區間內', () => {
  const a = assassinTargetScore('2026-07-20');
  const b = assassinTargetScore('2026-07-20');
  assert.equal(a, b);
  assert.ok(a >= ASSASSIN_BASE && a < ASSASSIN_BASE + ASSASSIN_SPAN, `${a} 應落在 [${ASSASSIN_BASE}, ${ASSASSIN_BASE + ASSASSIN_SPAN}) 內`);
  const c = assassinTargetScore('2026-07-21');
  assert.notEqual(a, c, '不同天應該（絕大多數情況下）算出不同防線，避免每天都一樣沒新鮮感');
});

test('buildEncounterScript：doubleDamage 出現機率已從共用表的過半權重降下來（張力校準）', () => {
  // 用大量固定 seed（決定性、非 Math.random）統計 doubleDamage 佔全部事件的比例。
  // 校準前 30/55 ≈ 55%；校準後 15/40 = 37.5%。統計 500 個 seed 的抽樣結果應明顯低於原本的 55%。
  let total = 0, doubleDamageCount = 0;
  for (let seed = 0; seed < 500; seed++) {
    const script = buildEncounterScript(seed);
    for (const ev of script.values()) {
      total += 1;
      if (ev.effect.type === 'doubleDamage') doubleDamageCount += 1;
    }
  }
  const ratio = doubleDamageCount / total;
  assert.ok(ratio < 0.45, `doubleDamage 佔比 ${ratio} 應明顯低於校準前的 55%`);
  assert.ok(ratio > 0.25, `doubleDamage 佔比 ${ratio} 不應被砍到失去存在感`);
});
