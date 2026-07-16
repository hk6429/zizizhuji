import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  INTRO_CARDS, OATHS, CUSTOM_OATH_ID, shouldShowIntro, markIntroSeen, swearOath, getOath,
} from '../../js/meta/oath.js';

test('intro has 3 cards (each ≤40 chars) and 4 oaths', () => {
  assert.equal(INTRO_CARDS.length, 3);
  for (const c of INTRO_CARDS) assert.ok(c.text.length <= 40, `card ${c.id} too long`);
  assert.equal(OATHS.length, 4);
});

test('shouldShowIntro true until markIntroSeen', () => {
  const meta = defaultMeta();
  assert.equal(shouldShowIntro(meta), true);
  markIntroSeen(meta);
  assert.equal(shouldShowIntro(meta), false);
});

test('swearOath first time succeeds; unknown oath rejected', () => {
  const meta = defaultMeta();
  assert.equal(swearOath(meta, 'nope', '2026-07-14').ok, false);
  const r = swearOath(meta, 'oath-2', '2026-07-14');
  assert.equal(r.ok, true);
  assert.equal(r.renewed, false);
  const cur = getOath(meta, '2026-07-14');
  assert.equal(cur.oathId, 'oath-2');
  assert.equal(cur.oathText, '我要讓錯字再也騙不了我');
  assert.equal(cur.canRenew, false);
});

test('renewal blocked before 30 days, allowed at 30 days, bumps renewCount', () => {
  const meta = defaultMeta();
  swearOath(meta, 'oath-1', '2026-07-14');
  assert.equal(swearOath(meta, 'oath-3', '2026-08-12').ok, false); // 29 天
  assert.equal(getOath(meta, '2026-08-13').canRenew, true); // 30 天
  const r = swearOath(meta, 'oath-3', '2026-08-13');
  assert.equal(r.ok, true);
  assert.equal(r.renewed, true);
  assert.equal(meta.oath.renewCount, 1);
});

test('first oath grants 1 starter charm; renewal does not', () => {
  const meta = defaultMeta();
  assert.equal(meta.daily.charms, 0);
  swearOath(meta, 'oath-1', '2026-07-14');
  assert.equal(meta.daily.charms, 1); // 新手立誓送起始護珠符
  swearOath(meta, 'oath-2', '2026-08-13'); // 30 天後換誓
  assert.equal(meta.daily.charms, 1); // 換誓不重複送
});

test('custom oath: 2–20 chars accepted and shown, out-of-range rejected', () => {
  const meta = defaultMeta();
  assert.equal(swearOath(meta, CUSTOM_OATH_ID, '2026-07-14', '一').ok, false); // 太短
  assert.equal(swearOath(meta, CUSTOM_OATH_ID, '2026-07-14', '字'.repeat(21)).ok, false); // 太長
  const r = swearOath(meta, CUSTOM_OATH_ID, '2026-07-14', '  我要天天練十題  ');
  assert.equal(r.ok, true);
  assert.equal(getOath(meta, '2026-07-14').oathText, '我要天天練十題'); // trim 後入檔
});

test('getOath returns null before any oath', () => {
  assert.equal(getOath(defaultMeta(), '2026-07-14'), null);
});
