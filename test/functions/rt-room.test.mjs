import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeD1 } from '../helpers/fake-d1.mjs';
import { onRequestPost } from '../../functions/api/rt-room.js';

const SNAP = { nick: '小書生', petId: 'qinglong', petName: '青龍', lv: 5, hp: 240, scope: { bank: 'mixed', level: '國小', difficulty: 'all' } };
const call = (env, body, ip = '1.2.3.4') => onRequestPost({
  request: new Request('http://x/api/rt-room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip, origin: 'https://zizizhuji.pages.dev' },
    body: JSON.stringify(body),
  }),
  env,
}).then(r => r.json());

const env = () => ({ zizizhuji_db: createFakeD1() });

test('create → join → push → poll 全流程', async () => {
  const e = env();
  const c = await call(e, { op: 'create', snap: SNAP });
  assert.equal(c.ok, 1);
  assert.match(c.code, /^\d{4}$/);
  assert.equal(typeof c.seed, 'number');

  const j = await call(e, { op: 'join', code: c.code, snap: { ...SNAP, nick: '對手' } }, '5.6.7.8');
  assert.equal(j.ok, 1);
  assert.equal(j.seed, c.seed);
  assert.deepEqual(j.scope, SNAP.scope);
  assert.equal(j.opp.nick, '小書生');

  const p = await call(e, { op: 'push', code: c.code, role: 'p2', state: { dmg: 30, round: 3, combo: 2, correct: 3, done: 0 } }, '5.6.7.8');
  assert.equal(p.ok, 1);

  const q = await call(e, { op: 'poll', code: c.code, role: 'p1' });
  assert.equal(q.ok, 1);
  assert.equal(q.opp.state.dmg, 30);
  assert.equal(q.opp.snap.nick, '對手');
  assert.equal(typeof q.now, 'number');
});

test('join：不存在的房回 ok:0；滿房回 ok:0', async () => {
  const e = env();
  const miss = await call(e, { op: 'join', code: '0000', snap: SNAP });
  assert.equal(miss.ok, 0);
  const c = await call(e, { op: 'create', snap: SNAP });
  await call(e, { op: 'join', code: c.code, snap: { ...SNAP, nick: '乙' } }, '5.6.7.8');
  const full = await call(e, { op: 'join', code: c.code, snap: { ...SNAP, nick: '丙' } }, '9.9.9.9');
  assert.equal(full.ok, 0);
});

test('輸入驗證：髒字暱稱、壞房號、壞 role、超界 state 全擋', async () => {
  const e = env();
  const bad = await call(e, { op: 'create', snap: { ...SNAP, nick: '笨蛋' } });
  assert.equal(bad.error, 'bad snap');
  assert.equal((await call(e, { op: 'push', code: 'abcd', role: 'p1', state: { dmg: 1 } })).error, 'bad req');
  assert.equal((await call(e, { op: 'push', code: '1234', role: 'p3', state: { dmg: 1 } })).error, 'bad req');
  const c = await call(e, { op: 'create', snap: SNAP });
  await call(e, { op: 'push', code: c.code, role: 'p1', state: { dmg: 999999999, round: 999, combo: -5, correct: 3, done: 1 } });
  const q = await call(e, { op: 'poll', code: c.code, role: 'p2' });
  assert.equal(q.opp.state.dmg, 99999);  // clamp 上限
  assert.equal(q.opp.state.round, 40);
  assert.equal(q.opp.state.combo, 0);
});

test('限流：同 IP create 超過 30 次回 429 錯誤', async () => {
  const e = env();
  let last = null;
  for (let i = 0; i < 31; i++) last = await call(e, { op: 'create', snap: SNAP });
  assert.ok(last.error && last.error.includes('頻繁'));
});
