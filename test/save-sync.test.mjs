import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCode } from '../js/save-sync.js';

test('generateCode：回傳 6 碼且字元皆屬白名單', () => {
  const CODE_RE = /^[A-Z0-9]{6}$/;
  const CONFUSING = /[01OI]/;
  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    assert.match(code, CODE_RE);
    assert.doesNotMatch(code, CONFUSING);
  }
});

test('generateCode：多次呼叫實務上不重複', () => {
  const seen = new Set();
  for (let i = 0; i < 100; i++) seen.add(generateCode());
  assert.ok(seen.size > 95, `100 次產生應幾乎全不重複，實際唯一數 ${seen.size}`);
});

test('generateCode：每組代碼保證至少有一個重複字元（好記）', () => {
  for (let i = 0; i < 50; i++) {
    const code = generateCode();
    const counts = new Map();
    for (const ch of code) counts.set(ch, (counts.get(ch) || 0) + 1);
    const hasDup = [...counts.values()].some((n) => n > 1);
    assert.ok(hasDup, `代碼「${code}」應含至少一個重複字元`);
  }
});
