// 題目回報：一鍵把有問題的題目送到老師的 Telegram（不落地存資料，純轉發）
// POST /api/report  body: { id, question, options, answer, note? }
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

async function rateLimited(env, ip) {
  const now = Date.now();
  const row = await env.zizizhuji_db.prepare('SELECT window_start, count FROM report_rl WHERE ip = ?1').bind(ip).first();
  if (!row || now - row.window_start > 5 * 60 * 1000) {
    await env.zizizhuji_db
      .prepare('INSERT INTO report_rl (ip, window_start, count) VALUES (?1, ?2, 1) ON CONFLICT(ip) DO UPDATE SET window_start=?2, count=1')
      .bind(ip, now)
      .run();
    return false;
  }
  if (row.count >= 5) return true;
  await env.zizizhuji_db
    .prepare('UPDATE report_rl SET count = count + 1 WHERE ip = ?1')
    .bind(ip)
    .run();
  return false;
}

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

  const TOKEN = env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = env.TELEGRAM_CHAT_ID;

  if (body?.op === 'health') {
    return new Response(
      JSON.stringify({ ok: true, tokenLen: (TOKEN || '').length, chatLen: (CHAT_ID || '').length }),
      { status: 200, headers: CORS },
    );
  }

  if (!TOKEN || !CHAT_ID) {
    return new Response(JSON.stringify({ ok: false, error: '回報功能尚未啟用' }), { status: 200, headers: CORS });
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  if (await rateLimited(env, ip)) {
    return new Response(JSON.stringify({ ok: false, error: '回報太頻繁，請稍候再試' }), { status: 429, headers: CORS });
  }

  const id = String(body?.id || '').trim().slice(0, 40);
  const question = String(body?.question || '').trim().slice(0, 300);
  const options = Array.isArray(body?.options) ? body.options.map((o) => String(o).slice(0, 30)) : [];
  const answer = String(body?.answer || '').trim().slice(0, 30);
  const note = String(body?.note || '').trim().slice(0, 200);
  if (!id || !question) {
    return new Response(JSON.stringify({ ok: false, error: '缺少題目內容' }), { status: 200, headers: CORS });
  }

  const text = [
    '🚩 字字珠璣・題目回報',
    `題號：${id}`,
    `題幹：${question}`,
    options.length ? `選項：${options.join('／')}` : '',
    answer ? `標準答案：${answer}` : '',
    note ? `備註：${note}` : '',
  ].filter(Boolean).join('\n');

  const tgRes = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: CHAT_ID, text }),
  });
  if (!tgRes.ok) {
    return new Response(JSON.stringify({ ok: false, error: '送出失敗，請稍後再試' }), { status: 200, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });
}
