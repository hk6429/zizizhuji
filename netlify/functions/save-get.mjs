import { getStore } from '@netlify/blobs';

// 跨裝置存檔同步：GET /.netlify/functions/save-get?code=XXXXXX
const CODE_RE = /^[A-Z0-9]{6}$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const code = String(url.searchParams.get('code') || '');
  if (!CODE_RE.test(code)) {
    return new Response(JSON.stringify({ error: 'bad code' }), { status: 400, headers: CORS });
  }

  const store = getStore('zizizhuji-saves');
  const raw = await store.get(code);
  if (!raw) {
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: CORS });
  }

  const parsed = JSON.parse(raw);
  return new Response(
    JSON.stringify({ ok: true, data: parsed.data, updatedAt: parsed.updatedAt }),
    { status: 200, headers: CORS },
  );
};
