// 班級排行榜（Netlify 版）：POST /api/lb-submit  body: { board, name, score }
// 透過 ../../lib/d1-http.js 打 Cloudflare D1 HTTP REST API，跟 Cloudflare Pages 版共用同一份資料。
import { CORS_POST, validateBoard, submitScore } from '../../lib/d1-http.js';

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_POST });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: CORS_POST });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'bad json' }), { status: 400, headers: CORS_POST });
  }

  const board = String(body?.board || '');
  const name = String(body?.name || '').trim().slice(0, 12);
  const score = Math.floor(Number(body?.score));

  if (!validateBoard(board)) {
    return new Response(JSON.stringify({ error: 'bad board' }), { status: 400, headers: CORS_POST });
  }
  if (!name) {
    return new Response(JSON.stringify({ error: 'bad name' }), { status: 400, headers: CORS_POST });
  }
  if (!Number.isFinite(score) || score < 0 || score > 999999) {
    return new Response(JSON.stringify({ error: 'bad score' }), { status: 400, headers: CORS_POST });
  }

  try {
    const top = await submitScore(board, name, score);
    return new Response(JSON.stringify({ ok: true, top }), { status: 200, headers: CORS_POST });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'upstream failure', detail: String(err?.message || err) }),
      { status: 502, headers: CORS_POST },
    );
  }
};

export const config = { path: '/api/lb-submit' };
