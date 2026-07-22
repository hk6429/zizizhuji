import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import { getBalance } from '../../js/meta/economy.js';
import { DAILY_QUESTS, getQuests, claimQuest, claimableCount } from '../../js/meta/quests.js';

const TODAY = '2026-07-22';

function meta() {
  const m = defaultMeta();
  m.daily.date = TODAY; // 避免 getQuests 內 rollover 把計數清掉
  return m;
}

test('三個任務：簡單/中等/困難各一，門檻遞增', () => {
  assert.equal(DAILY_QUESTS.length, 3);
  assert.deepEqual(DAILY_QUESTS.map((q) => q.tier), ['簡單', '中等', '困難']);
  assert.ok(DAILY_QUESTS[0].reward < DAILY_QUESTS[1].reward);
  assert.ok(DAILY_QUESTS[1].reward < DAILY_QUESTS[2].reward);
});

test('進度依 meta.daily 計數，達標才顯示 done', () => {
  const m = meta();
  m.daily.todayCorrect = 6;
  let q = getQuests(m, TODAY).find((x) => x.id === 'diligent');
  assert.equal(q.progress, 6);
  assert.equal(q.done, false);
  m.daily.todayCorrect = 12;
  q = getQuests(m, TODAY).find((x) => x.id === 'diligent');
  assert.equal(q.progress, 10); // 進度封頂在 goal
  assert.equal(q.done, true);
});

test('達標可領獎、發字珠、不受每日上限；重領被擋', () => {
  const m = meta();
  m.daily.todayBattles = 1;
  const before = getBalance(m);
  const r = claimQuest(m, 'duel', TODAY);
  assert.equal(r.ok, true);
  assert.equal(r.reward, 35);
  assert.equal(getBalance(m), before + 35);
  assert.deepEqual(m.daily.questsClaimed, ['duel']);
  const again = claimQuest(m, 'duel', TODAY);
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'claimed');
});

test('未達標不可領', () => {
  const m = meta();
  m.daily.todayAnswered = 20;
  const r = claimQuest(m, 'endure', TODAY);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'unmet');
});

test('claimableCount 只算達標且未領', () => {
  const m = meta();
  m.daily.todayCorrect = 10; // diligent 達標
  m.daily.todayBattles = 1;  // duel 達標
  assert.equal(claimableCount(m, TODAY), 2);
  claimQuest(m, 'diligent', TODAY);
  assert.equal(claimableCount(m, TODAY), 1);
});

test('跨日自動重置任務領取與計數', () => {
  const m = meta();
  m.daily.todayCorrect = 10;
  claimQuest(m, 'diligent', TODAY);
  assert.equal(m.daily.questsClaimed.includes('diligent'), true);
  const nextDay = '2026-07-23';
  const q = getQuests(m, nextDay).find((x) => x.id === 'diligent');
  assert.equal(q.claimed, false);   // 新的一天已重置
  assert.equal(q.progress, 0);
});
