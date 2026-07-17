// 班級排行榜（Vercel 版）：GET /api/lb-top?board=XXX
// 透過 lib/d1-http.js 打 Cloudflare D1 HTTP REST API，跟 Cloudflare Pages 版共用同一份資料。
import { CORS_GET, validateBoard, fetchTop } from '../lib/d1-http.js';

export default async function handler(req, res) {
  for (const [k, v] of Object.entries(CORS_GET)) res.setHeader(k, v);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const board = String(req.query?.board || '');
  if (!validateBoard(board)) {
    res.status(400).json({ error: 'bad board' });
    return;
  }

  try {
    const top = await fetchTop(board);
    res.status(200).json({ ok: true, top });
  } catch (err) {
    res.status(502).json({ error: 'upstream failure', detail: String(err?.message || err) });
  }
}
