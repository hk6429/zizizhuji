import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, buildQuestions, dealtDamage, judge, ROUNDS, DEAD_MS, buildEncounterScript, ENCOUNTER_EVERY } from '../../js/meta/rtbattle.js';
import { BATTLE_EVENTS } from '../../js/meta/encounter.js';

const mkEntries = (n) => Array.from({ length: n }, (_, i) => ({
  id: `q-${String(i).padStart(3, '0')}`, type: '字音',
  question: `題目${i}`, options: [`A${i}`, `B${i}`, `C${i}`, `D${i}`], answer: `A${i}`,
  difficulty: '中', explain: [],
}));

test('mulberry32：同 seed 序列完全一致', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test('buildQuestions：同 seed 同 entries → 同題同選項序；不重複；含正解', () => {
  const entries = mkEntries(60);
  const q1 = buildQuestions(7, entries);
  const q2 = buildQuestions(7, entries);
  assert.equal(q1.length, ROUNDS);
  assert.deepEqual(q1, q2);
  assert.equal(new Set(q1.map(q => q.id)).size, ROUNDS);
  for (const q of q1) {
    assert.ok(q.options.includes(q.answer));
    assert.equal(q.options.length, 4);
  }
});

test('buildQuestions：不看 entries 傳入順序（先排序再抽），且會洗選項順序', () => {
  const entries = mkEntries(60);
  const shuffled = [...entries].reverse();
  assert.deepEqual(buildQuestions(7, entries), buildQuestions(7, shuffled));
  const qs = buildQuestions(7, entries);
  assert.ok(qs.some((q, i) => q.options[0] !== q.answer), '正解不可固定在第一位');
});

test('buildQuestions：題庫不足 rounds 時全取', () => {
  assert.equal(buildQuestions(1, mkEntries(8)).length, 8);
});

test('dealtDamage：取 hpB 差值、不為負', () => {
  assert.equal(dealtDamage({ hpB: 200 }, { hpB: 187 }), 13);
  assert.equal(dealtDamage({ hpB: 100 }, { hpB: 100 }), 0);
  assert.equal(dealtDamage({ hpB: 100 }, { hpB: 120 }), 0); // 對方回血不倒扣
});

test('judge：血量歸零、雙完比血、斷線判勝、未分勝負', () => {
  const base = { myHp: 100, oppHp: 100, myDone: false, oppDone: false, oppHbAgeMs: 0 };
  assert.equal(judge({ ...base, myHp: 0 }), 'lose');
  assert.equal(judge({ ...base, oppHp: 0 }), 'win');
  assert.equal(judge({ ...base, myDone: true, oppDone: true, myHp: 80, oppHp: 60 }), 'win');
  assert.equal(judge({ ...base, myDone: true, oppDone: true, myHp: 60, oppHp: 60 }), 'draw');
  assert.equal(judge({ ...base, oppHbAgeMs: DEAD_MS + 1 }), 'win');
  assert.equal(judge(base), null);
});

test('buildEncounterScript：每 5 題一事件、同 seed 同序列、只用 adapter 支援的效果', () => {
  const s1 = buildEncounterScript(99);
  const s2 = buildEncounterScript(99);
  assert.deepEqual([...s1.keys()], [5, 10, 15, 20]);
  assert.deepEqual([...s1.entries()], [...s2.entries()]);
  const okTypes = new Set(['doubleDamage', 'eliminate', 'comboThreshold']);
  for (const ev of s1.values()) {
    assert.ok(okTypes.has(ev.effect.type), `不支援的效果 ${ev.effect.type}`);
    assert.ok(BATTLE_EVENTS.some(b => b.id === ev.id), '事件必須出自既有 BATTLE_EVENTS');
  }
});

test('buildEncounterScript：不同 seed 大機率不同序列、相鄰不重複同事件', () => {
  const ids = (m) => [...m.values()].map(e => e.id).join(',');
  assert.notEqual(ids(buildEncounterScript(1)), ids(buildEncounterScript(2)));
  for (let seed = 0; seed < 50; seed++) {
    const seq = [...buildEncounterScript(seed).values()].map(e => e.id);
    for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1]);
  }
});
