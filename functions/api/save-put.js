// 跨裝置存檔同步：POST /api/save-put?code=XXXXXX  body: { data, updatedAt }
// Cloudflare Pages Function，D1 綁定名稱 zizizhuji_db（見 wrangler.toml）。
const CODE_RE = /^[A-Z0-9]{6}$/;
const MAX_BYTES = 300_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '');
  if (!CODE_RE.test(code)) {
    return new Response(JSON.stringify({ error: 'bad code' }), { status: 400, headers: CORS });
  }

  let body;
  try {
    body = await request.json();
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

  const payload = JSON.stringify(data);
  if (payload.length > MAX_BYTES) {
    return new Response(JSON.stringify({ error: 'too large' }), { status: 413, headers: CORS });
  }

  await env.zizizhuji_db
    .prepare('INSERT INTO saves (code, data, updated_at) VALUES (?1, ?2, ?3) ON CONFLICT(code) DO UPDATE SET data=?2, updated_at=?3')
    .bind(code, payload, updatedAt)
    .run();

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
}
