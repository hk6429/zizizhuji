import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeD1 } from '../helpers/fake-d1.mjs';
import { onRequestPost } from '../../functions/api/rt-live.js';

const call = (env, body, ip = '1.2.3.4') => onRequestPost({
  request: new Request('http://x/api/rt-live', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip, origin: 'https://zizizhuji.pages.dev' },
    body: JSON.stringify(body),
  }),
  env,
}).then(r => r.json());

const env = () => ({ zizizhuji_db: createFakeD1() });

test('start → state → answer → next → roster → end 全流程', async () => {
  const e = env();
  const scope = { bank: 'mixed', level: '國小', difficulty: 'all' };
  const s = await call(e, { op: 'start', code: '五年三班', pin: '8888', qn: 10, scope });
  assert.equal(s.ok, 1);
  assert.equal(s.live.phase, 'lobby');
  assert.equal(typeof s.live.seed, 'number');

  const st = await call(e, { op: 'state', code: '五年三班' });
  assert.equal(st.ok, 1);
  assert.equal(st.live.pin, undefined);  // pin 絕不外洩

  const n = await call(e, { op: 'next', code: '五年三班', pin: '8888' });
  assert.equal(n.live.phase, 'q');
  assert.equal(n.live.qNo, 1);
  assert.equal((await call(e, { op: 'next', code: '五年三班', pin: '0000' })).ok, 0); // 錯主持碼

  await call(e, { op: 'answer', code: '五年三班', nick: '小明', qNo: 1, correct: true });
  await call(e, { op: 'answer', code: '五年三班', nick: '小華', qNo: 1, correct: false });
  const r = await call(e, { op: 'roster', code: '五年三班' });
  assert.equal(r.ok, 1);
  assert.deepEqual(r.list[0], { nick: '小明', score: 1, qNo: 1, hist: '1' });
  assert.deepEqual(r.list[1], { nick: '小華', score: 0, qNo: 1, hist: '0' });

  const end = await call(e, { op: 'end', code: '五年三班', pin: '8888' });
  assert.equal(end.live.phase, 'end');
});

test('answer：重複回報同一題不重複計分；髒字暱稱擋下', async () => {
  const e = env();
  await call(e, { op: 'start', code: 'c1', pin: '1234', qn: 5, scope: { bank: 'ziyin', level: '國小', difficulty: 'all' } });
  await call(e, { op: 'next', code: 'c1', pin: '1234' });
  await call(e, { op: 'answer', code: 'c1', nick: '阿珠', qNo: 1, correct: true });
  await call(e, { op: 'answer', code: 'c1', nick: '阿珠', qNo: 1, correct: true }); // 重送
  const r = await call(e, { op: 'roster', code: 'c1' });
  assert.equal(r.list[0].score, 1);
  assert.equal((await call(e, { op: 'answer', code: 'c1', nick: '白癡', qNo: 1, correct: true })).ok, 0);
});
