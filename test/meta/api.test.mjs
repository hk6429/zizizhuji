import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiBase, createApi, API_ORIGIN } from '../../js/meta/api.js';

test('apiBase：pages.dev 同源與本機開發回空字串', () => {
  assert.equal(apiBase('zizizhuji.pages.dev'), '');
  assert.equal(apiBase('localhost'), '');
  assert.equal(apiBase('127.0.0.1'), '');
});

test('apiBase：鏡像站一律回絕對網址', () => {
  assert.equal(apiBase('zizizhuji.vercel.app'), API_ORIGIN);
  assert.equal(apiBase('zizizhuji.netlify.app'), API_ORIGIN);
  assert.equal(apiBase('example.com'), API_ORIGIN);
});

test('call：在鏡像站 host 下打絕對網址、帶 JSON body', async () => {
  let seen = null;
  const api = createApi({
    hostname: 'zizizhuji.vercel.app',
    fetchFn: async (url, opts) => { seen = { url, opts }; return { json: async () => ({ ok: 1 }) }; },
  });
  const r = await api.call('/api/rt-room', { body: { op: 'poll' } });
  assert.equal(seen.url, `${API_ORIGIN}/api/rt-room`);
  assert.equal(seen.opts.method, 'POST');
  assert.equal(seen.opts.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(seen.opts.body), { op: 'poll' });
  assert.deepEqual(r, { ok: 1 });
});

test('call：GET 不帶 body、網路失敗回 null、路徑不合法 throw', async () => {
  const api = createApi({ hostname: 'zizizhuji.pages.dev', fetchFn: async () => { throw new Error('offline'); } });
  assert.equal(await api.call('/api/rt-room', { body: { op: 'poll' } }), null);
  await assert.rejects(() => api.call('rt-room'), TypeError);
  let seen = null;
  const api2 = createApi({ hostname: 'zizizhuji.pages.dev', fetchFn: async (url, opts) => { seen = opts; return { json: async () => ({}) }; } });
  await api2.call('/api/rt-room', { method: 'GET' });
  assert.equal(seen.body, undefined);
});
