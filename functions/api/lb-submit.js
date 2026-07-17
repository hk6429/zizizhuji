// 班級排行榜：POST /api/lb-submit  body: { board, name, score }
// Cloudflare Pages Function，D1 綁定名稱 zizizhuji_db（見 wrangler.toml）。
// 同 board+name 只留個人最佳分數（分數變低不覆蓋），回傳該榜前 20 名。
const BOARD_RE = /^[\w一-鿿]{1,20}(::(progress|streak))?$/;
const TOP_N = 20;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS });
  }

  const board = String(body?.board || '');
  const name = String(body?.name || '').trim().slice(0, 12);
  const score = Math.floor(Number(body?.score));

  if (!BOARD_RE.test(board)) {
    return new Response(JSON.stringify({ error: 'bad board' }), { status: 400, headers: CORS });
  }
  if (!name) {
    return new Response(JSON.stringify({ error: 'bad name' }), { status: 400, headers: CORS });
  }
  if (!Number.isFinite(score) || score < 0 || score > 999999) {
    return new Response(JSON.stringify({ error: 'bad score' }), { status: 400, headers: CORS });
  }

  await env.zizizhuji_db
    .prepare(
      'INSERT INTO leaderboard (board, name, score, updated_at) VALUES (?1, ?2, ?3, ?4) ' +
      'ON CONFLICT(board, name) DO UPDATE SET score=?3, updated_at=?4 WHERE ?3 > leaderboard.score',
    )
    .bind(board, name, score, Date.now())
    .run();

  const { results } = await env.zizizhuji_db
    .prepare('SELECT name, score FROM leaderboard WHERE board = ?1 ORDER BY score DESC LIMIT ?2')
    .bind(board, TOP_N)
    .all();

  return new Response(JSON.stringify({ ok: true, top: results || [] }), { status: 200, headers: CORS });
}
