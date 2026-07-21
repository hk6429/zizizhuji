// 排行榜：GET /api/lb-top?board=XXX（班級榜前 20；全服天下文氣榜 __tianxia__ 前 500）
const BOARD_RE = /^[\w一-鿿]{1,20}(::(progress|streak))?$/;
const GLOBAL_BOARD = '__tianxia__';
function limitFor(board) { return board === GLOBAL_BOARD ? 500 : 20; }

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const board = String(url.searchParams.get('board') || '');
  if (!BOARD_RE.test(board)) {
    return new Response(JSON.stringify({ error: 'bad board' }), { status: 400, headers: CORS });
  }

  const { results } = await env.zizizhuji_db
    .prepare('SELECT name, score FROM leaderboard WHERE board = ?1 ORDER BY score DESC LIMIT ?2')
    .bind(board, limitFor(board))
    .all();

  return new Response(JSON.stringify({ ok: true, top: results || [] }), { status: 200, headers: CORS });
}
