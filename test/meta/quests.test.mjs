import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import { getBalance } from '../../js/meta/economy.js';
import { DAILY_QUESTS, QUEST_LINES, getQuests, getQuestLines, claimQuest, claimableCount } from '../../js/meta/quests.js';

const TODAY = '2026-07-22';

function meta() {
  const m = defaultMeta();
  m.daily.date = TODAY; // 避免 getQuests 內 rollover 把計數清掉
  return m;
}

test('三主線各拆易/中/難＝9 個任務，同線門檻與獎勵遞增', () => {
  assert.equal(QUEST_LINES.length, 3);
  assert.equal(DAILY_QUESTS.length, 9);
  for (const line of QUEST_LINES) {
    const tiers = DAILY_QUESTS.filter((q) => q.line === line.key);
    assert.deepEqual(tiers.map((q) => q.tier), ['易', '中', '難']);
    assert.ok(tiers[0].goal < tiers[1].goal && tiers[1].goal < tiers[2].goal, `${line.name} 門檻應遞增`);
    assert.ok(tiers[0].reward < tiers[1].reward && tiers[1].reward < tiers[2].reward, `${line.name} 獎勵應遞增`);
  }
});

test('id = 主線-階，且唯一', () => {
  const ids = DAILY_QUESTS.map((q) => q.id);
  assert.ok(ids.includes('diligent-易') && ids.includes('endure-難'));
  assert.equal(new Set(ids).size, 9);
});

test('進度依 meta.daily 計數，跨階各自達標', () => {
  const m = meta();
  m.daily.todayCorrect = 15;
  const qs = getQuests(m, TODAY).filter((x) => x.line === 'diligent');
  assert.equal(qs.find((q) => q.tier === '易').done, true);   // 門檻 5
  assert.equal(qs.find((q) => q.tier === '中').done, true);   // 門檻 15
  assert.equal(qs.find((q) => q.tier === '難').done, false);  // 門檻 30
  assert.equal(qs.find((q) => q.tier === '難').progress, 15); // 進度封頂在 goal 之下如實顯示
});

test('完成一階即可各自領獎、發字珠、不受每日上限；重領被擋', () => {
  const m = meta();
  m.daily.todayBattles = 1;
  const before = getBalance(m);
  const r = claimQuest(m, 'duel-易', TODAY);
  assert.equal(r.ok, true);
  assert.equal(r.reward, 15);
  assert.equal(getBalance(m), before + 15);
  assert.deepEqual(m.daily.questsClaimed, ['duel-易']);
  const again = claimQuest(m, 'duel-易', TODAY);
  assert.equal(again.ok, false);
  assert.equal(again.reason, 'claimed');
});

test('未達標不可領（同線高階仍鎖）', () => {
  const m = meta();
  m.daily.todayAnswered = 20; // endure 易(20)達標、中(50)未達
  assert.equal(claimQuest(m, 'endure-中', TODAY).reason, 'unmet');
  assert.equal(claimQuest(m, 'endure-易', TODAY).ok, true);
});

test('getQuestLines 依主線分組、帶當前計數', () => {
  const m = meta();
  m.daily.todayCorrect = 6;
  const lines = getQuestLines(m, TODAY);
  assert.deepEqual(lines.map((l) => l.name), ['勤學', '對弈', '不輟']);
  const diligent = lines.find((l) => l.key === 'diligent');
  assert.equal(diligent.value, 6);
  assert.equal(diligent.tiers.length, 3);
});

test('claimableCount 只算達標且未領', () => {
  const m = meta();
  m.daily.todayCorrect = 15; // diligent 易+中 達標＝2
  m.daily.todayBattles = 1;  // duel 易 達標＝1
  assert.equal(claimableCount(m, TODAY), 3);
  claimQuest(m, 'diligent-易', TODAY);
  assert.equal(claimableCount(m, TODAY), 2);
});

test('跨日自動重置任務領取與計數', () => {
  const m = meta();
  m.daily.todayCorrect = 10;
  claimQuest(m, 'diligent-易', TODAY);
  assert.equal(m.daily.questsClaimed.includes('diligent-易'), true);
  const nextDay = '2026-07-23';
  const q = getQuests(m, nextDay).find((x) => x.id === 'diligent-易');
  assert.equal(q.claimed, false);   // 新的一天已重置
  assert.equal(q.progress, 0);
});
