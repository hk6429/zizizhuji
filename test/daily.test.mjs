import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rolloverDaily, getBoxState, openBox } from '../js/meta/daily.js';

function makeMeta(overrides = {}) {
  return {
    daily: {
      date: '', todayCorrect: 0, streak: 0, best: 0, tier: 0, boxOpened: false,
      lastLit: '', weekKey: '', weekOpenDays: [], liuliOpened: false, liuliHalfOpened: false,
      charms: 0, milestonesClaimed: [],
      ...overrides,
    },
    pearls: { balance: 0, earnedToday: 0, earnedDate: '' },
  };
}

function withNoDamage(on, fn) {
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: () => (on ? '1' : '0') };
  try { fn(); } finally {
    if (prev === undefined) delete globalThis.localStorage; else globalThis.localStorage = prev;
  }
}

test('rolloverDaily 預設模式下漏簽會硬歸零連燈數，文案不帶恐嚇字眼', () => {
  withNoDamage(false, () => {
    const meta = makeMeta({ lastLit: '2026-01-01', streak: 5 });
    const events = rolloverDaily(meta, '2026-01-03');
    assert.equal(meta.daily.streak, 0);
    const ev = events.find((e) => e.type === 'lanternOut');
    assert.ok(ev);
    assert.equal(ev.payload.softened, false);
    assert.doesNotMatch(ev.payload.message, /侵蝕|趁夜/);
  });
});

test('rolloverDaily 無傷模式下漏簽只腰斬連燈數，不歸零', () => {
  withNoDamage(true, () => {
    const meta = makeMeta({ lastLit: '2026-01-01', streak: 5 });
    const events = rolloverDaily(meta, '2026-01-03');
    assert.equal(meta.daily.streak, 2); // floor(5/2)
    const ev = events.find((e) => e.type === 'lanternOut');
    assert.equal(ev.payload.softened, true);
  });
});

test('rolloverDaily 有護珠符時優先扣符守住連燈，不觸發歸零/腰斬', () => {
  const meta = makeMeta({ lastLit: '2026-01-01', streak: 5, charms: 2 });
  const events = rolloverDaily(meta, '2026-01-03');
  assert.equal(meta.daily.streak, 5);
  assert.equal(meta.daily.charms, 1);
  assert.ok(events.find((e) => e.type === 'charmUsed'));
});

test('getBoxState：週日只要尚未領過分潤就顯示琉璃可開，不卡全勤門檻', () => {
  // date 對齊查詢日，避免 rolloverDaily 因 weekKey 未設而把 weekOpenDays 清空
  const meta = makeMeta({ date: '2026-01-04', weekOpenDays: ['2026-01-01', '2026-01-02', '2026-01-03'] });
  const state = getBoxState(meta, '2026-01-04'); // 週日
  assert.equal(state.liuliAvailable, true);
});

test('openBox：週日分潤照開匣天數線性計，3-4 天冠半程使者，只發一次', () => {
  const meta = makeMeta({
    date: '2026-01-04', lastLit: '2026-01-04', boxOpened: false,
    weekOpenDays: ['2026-01-01', '2026-01-02', '2026-01-03'],
  });
  const r1 = openBox(meta, '2026-01-04', () => 0); // 開匣後含今天共 4 天
  assert.equal(r1.reward.weekDays, 4);
  assert.equal(r1.reward.pearls, 3 + 4 * 4);
  assert.equal(r1.reward.weekTitle, '本週半程使者');
  assert.equal(meta.daily.liuliOpened, true);

  meta.daily.boxOpened = false;
  const state = getBoxState(meta, '2026-01-04');
  assert.equal(state.liuliAvailable, false); // 已領過，不再出現
});
