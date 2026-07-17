import { getStore } from '@netlify/blobs';

// 跨裝置存檔同步：POST /.netlify/functions/save-put?code=XXXXXX
// body: { data, updatedAt }。code 是前端隨機產生的存取金鑰，非帳號密碼。
const CODE_RE = /^[A-Z0-9]{6}$/;
const MAX_BYTES = 300_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: CORS });
  }

  const url = new URL(req.url);
  const code = String(url.searchParams.get('code') || '');
  if (!CODE_RE.test(code)) {
    return new Response(JSON.stringify({ error: 'bad code' }), { status: 400, headers: CORS });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS });
  }

  const data = body && body.data;
  const updatedAt = Math.floor(Number(body && body.updatedAt));
  if (!data || typeof data !== 'object') {
    return new Response(JSON.stringify({ error: 'bad data' }), { status: 400, headers: CORS });
  }
  if (!Number.isFinite(updatedAt)) {
    return new Response(JSON.stringify({ error: 'bad updatedAt' }), { status: 400, headers: CORS });
  }

  const payload = JSON.stringify({ data, updatedAt });
  if (payload.length > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'too large' }), { status: 413, headers: CORS });
  }

  const store = getStore('zizizhuji-saves');
  await store.set(code, payload);
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
};
