import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  DAILY_GOAL, LANTERN_TIERS, OMENS,
  dayDiff, isoWeekKey, isSunday,
  recordDailyCorrect, recordDailyAnswered, getLanternState, getBoxState, openBox, getOmen,
} from '../../js/meta/daily.js';

function lightDay(meta, day) {
  return recordDailyCorrect(meta, DAILY_GOAL, day);
}

test('date helpers: dayDiff / isoWeekKey / isSunday', () => {
  assert.equal(dayDiff('2026-07-14', '2026-07-15'), 1);
  assert.equal(dayDiff('2026-07-14', '2026-07-14'), 0);
  assert.equal(dayDiff('2026-06-30', '2026-07-02'), 2);
  assert.equal(isoWeekKey('2026-07-14'), isoWeekKey('2026-07-19')); // Tue..Sun same ISO week
  assert.notEqual(isoWeekKey('2026-07-19'), isoWeekKey('2026-07-20')); // Sun vs next Mon
  assert.equal(isSunday('2026-07-19'), true);
  assert.equal(isSunday('2026-07-14'), false);
});

test('lantern lights exactly when reaching the daily goal of 10', () => {
  const meta = defaultMeta();
  let r = recordDailyCorrect(meta, 9, '2026-07-14');
  assert.ok(!r.events.some(e => e.type === 'lanternLit'));
  assert.equal(getLanternState(meta, '2026-07-14').litToday, false);
  r = recordDailyCorrect(meta, 1, '2026-07-14');
  assert.ok(r.events.some(e => e.type === 'lanternLit'));
  assert.ok(r.events.some(e => e.type === 'boxUnlocked'));
  assert.equal(meta.daily.streak, 1);
  // 再答對不重複點燈
  r = recordDailyCorrect(meta, 5, '2026-07-14');
  assert.ok(!r.events.some(e => e.type === 'lanternLit'));
  assert.equal(meta.daily.streak, 1);
});

test('streak grows across consecutive days; milestone at 3 days grants pearls + title', () => {
  const meta = defaultMeta();
  lightDay(meta, '2026-07-14');
  lightDay(meta, '2026-07-15');
  const r = lightDay(meta, '2026-07-16');
  assert.equal(meta.daily.streak, 3);
  const ms = r.events.find(e => e.type === 'lanternMilestone');
  assert.ok(ms);
  assert.equal(ms.payload.pearls, 5);
  assert.equal(ms.payload.title, '初燃墨燈');
  assert.equal(meta.pearls.balance, 5); // milestone pearls landed (cap-exempt)
});

test('missed day breaks streak but keeps tier; lanternOut event fires', () => {
  const meta = defaultMeta();
  // 7 天連續 → tier 1 銅燈
  const days = ['2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10', '2026-07-11', '2026-07-12'];
  for (const d of days) lightDay(meta, d);
  assert.equal(meta.daily.tier, 1);
  assert.equal(meta.daily.charms, 1); // 滿 7 天送護珠符
  // 花掉護珠符（先清空以測斷守）
  meta.daily.charms = 0;
  const r = recordDailyCorrect(meta, 1, '2026-07-14'); // 7/13 漏掉
  assert.ok(r.events.some(e => e.type === 'lanternOut'));
  assert.equal(meta.daily.streak, 0);
  assert.equal(meta.daily.tier, 1); // 不清階級
});

test('charm auto-freezes a missed day and preserves the streak', () => {
  const meta = defaultMeta();
  lightDay(meta, '2026-07-10');
  lightDay(meta, '2026-07-11');
  meta.daily.charms = 1;
  const r = recordDailyCorrect(meta, 1, '2026-07-13'); // 7/12 漏掉
  assert.ok(r.events.some(e => e.type === 'charmUsed'));
  assert.equal(meta.daily.streak, 2); // 保住
  assert.equal(meta.daily.charms, 0);
  lightDay(meta, '2026-07-13');
  assert.equal(meta.daily.streak, 3);
});

test('box: locked before goal, opens once, never twice', () => {
  const meta = defaultMeta();
  assert.equal(openBox(meta, '2026-07-14').ok, false);
  lightDay(meta, '2026-07-14');
  assert.equal(getBoxState(meta, '2026-07-14').unlocked, true);
  const r = openBox(meta, '2026-07-14', () => 0.5);
  assert.ok(r.reward);
  assert.ok(r.reward.pearls >= 3 && r.reward.pearls <= 8);
  assert.equal(openBox(meta, '2026-07-14').ok, false);
});

test('liuli on Sunday pays linearly: 5 weekdays + Sunday = 6 days × 4 pearls, full title', () => {
  const meta = defaultMeta();
  const week = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17']; // Mon-Fri
  for (const d of week) {
    lightDay(meta, d);
    openBox(meta, d, () => 0);
  }
  lightDay(meta, '2026-07-19'); // Sunday
  assert.equal(getBoxState(meta, '2026-07-19').liuliAvailable, true);
  const r = openBox(meta, '2026-07-19', () => 0);
  assert.equal(r.reward.liuli, true);
  assert.equal(r.reward.weekDays, 6);
  assert.equal(r.reward.pearls, 3 + 6 * 4);
  assert.equal(r.reward.weekTitle, '本週琉璃使者');
});

test('liuli with fewer than 5 open days still pays linearly with half title', () => {
  const meta = defaultMeta();
  for (const d of ['2026-07-17', '2026-07-18']) {
    lightDay(meta, d);
    openBox(meta, d, () => 0);
  }
  lightDay(meta, '2026-07-19');
  assert.equal(getBoxState(meta, '2026-07-19').liuliAvailable, true);
  const r = openBox(meta, '2026-07-19', () => 0);
  assert.equal(r.reward.liuli, false);
  assert.equal(r.reward.weekDays, 3);
  assert.equal(r.reward.pearls, 3 + 3 * 4);
  assert.equal(r.reward.weekTitle, '本週半程使者');
});

test('liuli pays only once per week even if box reopens', () => {
  const meta = defaultMeta();
  lightDay(meta, '2026-07-19');
  const r = openBox(meta, '2026-07-19', () => 0);
  assert.equal(r.reward.weekDays, 1);
  assert.equal(r.reward.pearls, 3 + 1 * 4);
  assert.equal(r.reward.weekTitle, null); // 1 天不冠稱號，但仍有分潤
  assert.equal(getBoxState(meta, '2026-07-19').liuliAvailable, false);
});

test('week rollover clears weekOpenDays', () => {
  const meta = defaultMeta();
  lightDay(meta, '2026-07-19');
  openBox(meta, '2026-07-19', () => 0);
  assert.equal(getBoxState(meta, '2026-07-20').weekOpenDays.length, 0); // next ISO week
});

test('lantern tiers ladder is 油燈→銅燈(7)→琉璃燈(21)→七寶燈(49)→不滅聖燈(100)', () => {
  assert.deepEqual(LANTERN_TIERS.map(t => t.minStreak), [0, 7, 21, 49, 100]);
});

test('getOmen is deterministic for the same date and covers 7 omens', () => {
  assert.equal(OMENS.length, 7);
  const a = getOmen('2026-07-14');
  const b = getOmen('2026-07-14');
  assert.deepEqual(a, b);
  assert.ok(OMENS.some(o => o.id === a.omenId));
  // 不同日期會輪替（至少 30 天內出現超過一種）
  const seen = new Set();
  for (let i = 1; i <= 30; i++) seen.add(getOmen(`2026-06-${String(i).padStart(2, '0')}`).omenId);
  assert.ok(seen.size > 1);
});

test('recordDailyAnswered accumulates regardless of correctness', () => {
  const meta = defaultMeta();
  recordDailyAnswered(meta, '2026-07-14');
  recordDailyAnswered(meta, '2026-07-14');
  recordDailyAnswered(meta, '2026-07-14');
  assert.equal(meta.daily.todayAnswered, 3);
  assert.equal(meta.daily.todayCorrect, 0); // 沒呼叫 recordDailyCorrect 不會動到
});

test('rolloverDaily pushes previous day snapshot into trend and resets todayAnswered', () => {
  const meta = defaultMeta();
  recordDailyAnswered(meta, '2026-07-14');
  recordDailyAnswered(meta, '2026-07-14');
  recordDailyCorrect(meta, 1, '2026-07-14');
  // 跨日：任何 rolloverDaily 觸發點都可以（這裡用 recordDailyAnswered 觸發）
  recordDailyAnswered(meta, '2026-07-15');
  assert.equal(meta.trend.length, 1);
  assert.deepEqual(meta.trend[0], { date: '2026-07-14', answered: 2, correct: 1 });
  assert.equal(meta.daily.todayAnswered, 1); // 跨日重置後這次呼叫算 1
});

test('trend array caps at 30 entries, shifting out the oldest', () => {
  const meta = defaultMeta();
  for (let i = 1; i <= 32; i++) {
    const day = `2026-07-${String(i).padStart(2, '0')}`;
    recordDailyAnswered(meta, day);
  }
  assert.equal(meta.trend.length, 30);
  assert.equal(meta.trend[0].date, '2026-07-02'); // 前兩天被 shift 掉
  assert.equal(meta.trend[meta.trend.length - 1].date, '2026-07-31');
});
