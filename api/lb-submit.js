// 班級排行榜（Vercel 版）：POST /api/lb-submit  body: { board, name, score }
// 透過 lib/d1-http.js 打 Cloudflare D1 HTTP REST API，跟 Cloudflare Pages 版共用同一份資料。
import { CORS_POST, validateBoard, submitScore } from '../lib/d1-http.js';

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS_POST)) res.setHeader(k, v);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body = req.body || {};
  const board = String(body.board || '');
  const name = String(body.name || '').trim().slice(0, 12);
  const score = Math.floor(Number(body.score));

  if (!validateBoard(board)) {
    res.status(400).json({ error: 'bad board' });
    return;
  }
  if (!name) {
    res.status(400).json({ error: 'bad name' });
    return;
  }
  if (!Number.isFinite(score) || score < 0 || score > 999999) {
    res.status(400).json({ error: 'bad score' });
    return;
  }

  try {
    const top = await submitScore(board, name, score);
    res.status(200).json({ ok: true, top });
  } catch (err) {
    res.status(502).json({ error: 'upstream failure', detail: String(err?.message || err) });
  }
}
