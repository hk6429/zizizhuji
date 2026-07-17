// 班級排行榜（Netlify 版）：GET /api/lb-top?board=XXX
// 透過 ../../lib/d1-http.js 打 Cloudflare D1 HTTP REST API，跟 Cloudflare Pages 版共用同一份資料。
import { CORS_GET, validateBoard, fetchTop } from '../../lib/d1-http.js';

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_GET });
  }
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: CORS_GET });
  }

  const url = new URL(req.url);
  const board = String(url.searchParams.get('board') || '');
  if (!validateBoard(board)) {
    return new Response(JSON.stringify({ error: 'bad board' }), { status: 400, headers: CORS_GET });
  }

  try {
    const top = await fetchTop(board);
    return new Response(JSON.stringify({ ok: true, top }), { status: 200, headers: CORS_GET });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'upstream failure', detail: String(err?.message || err) }),
      { status: 502, headers: CORS_GET },
    );
  }
};

export const config = { path: '/api/lb-top' };
