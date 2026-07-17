// 跨裝置存檔同步：GET /api/save-get?code=XXXXXX
const CODE_RE = /^[A-Z0-9]{6}$/;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '');
  if (!CODE_RE.test(code)) {
    return new Response(JSON.stringify({ error: 'bad code' }), { status: 400, headers: CORS });
  }

  const row = await env.zizizhuji_db
    .prepare('SELECT data, updated_at FROM saves WHERE code = ?1')
    .bind(code)
    .first();

  if (!row) {
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: CORS });
  }

  return new Response(
    JSON.stringify({ ok: true, data: JSON.parse(row.data), updatedAt: row.updated_at }),
    { status: 200, headers: CORS },
  );
}
