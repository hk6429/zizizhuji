import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeBoard, buildLiveHerald } from '../../js/meta/livewall.js';

const rows = [
  { nick: '甲', score: 9 }, { nick: '乙', score: 8 }, { nick: '丙', score: 7 },
  { nick: '丁', score: 6 }, { nick: '戊', score: 5 }, { nick: '己', score: 4 }, { nick: '庚', score: 1 },
];

test('safeBoard：只露前 5＋自己的名次，不洩漏倒數名單', () => {
  const b = safeBoard(rows, '庚');
  assert.equal(b.top.length, 5);
  assert.deepEqual(b.top.map(r => r.nick), ['甲', '乙', '丙', '丁', '戊']);
  assert.deepEqual(b.me, { rank: 7, nick: '庚', score: 1 });
  assert.equal(b.total, 7);
  assert.ok(!('rows' in b), '不可整份名單外流');
});

test('safeBoard：自己在前段就不重複列、查無自己回 me:null', () => {
  assert.equal(safeBoard(rows, '甲').me, null);   // 已在 top 內
  assert.equal(safeBoard(rows, '路人').me, null);
});

test('buildLiveHerald：墨靈宣讀開頭、冠軍入詞、收尾賀詞；空榜給邀戰詞', () => {
  const lines = buildLiveHerald({ week: '2026-07-20', rows });
  assert.match(lines[0], /^墨靈宣讀：/);
  assert.ok(lines.some(l => l.includes('甲')));
  assert.match(lines[lines.length - 1], /濁墨退散/);
  const empty = buildLiveHerald({ week: '2026-07-20', rows: [] });
  assert.match(empty[0], /^墨靈宣讀：/);
});
