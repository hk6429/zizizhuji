// 全班戰況牆 — 老師開房（班級碼+自訂主持碼），全班同 seed 同題，輪詢同步。
// POST { op:'start', code, pin, qn(5|10|15), scope } → 開場（同碼有進行中場次先擋）
// POST { op:'state', code }                          → 學生輪詢場況（不含 pin）
// POST { op:'next', code, pin } / { op:'end', code, pin } → 老師主持（主持碼不對回 ok:0）
// POST { op:'answer', code, nick, qNo, correct }      → 學生回報作答（qNo 不大於已記錄則忽略，防重送灌分）
// POST { op:'roster', code }                          → 名冊，score 降冪
// 結構移植自 vocab-duel functions/api/live.js 的 op 骨架；
// CORS/okNick/stripBad/cleanScope/rateLimited 沿用 rt-room.js 同款寫法，儲存改走 kvFor(D1)。
import { kvFor } from './_kv.js';

const TTL = 7200; // 隨堂戰況壽命 2 小時
const keyOf = (code) => `rt:live:${code}`;
const rosterKeyOf = (code) => `rt:live:${code}:roster`;
const okCode = (c) => typeof c === 'string' && /^[一-鿿A-Za-z0-9_-]{2,16}$/.test(c);
const okPin = (p) => typeof p === 'string' && /^\d{4,8}$/.test(p);
const okQn = (n) => [5, 10, 15].includes(n);

// 暱稱黑名單：常見中英文辱罵字詞（非窮舉），暱稱會顯示在戰況牆，擋掉明顯攻擊性暱稱
const BAD_WORDS = /笨蛋|白癡|智障|廢物|去死|三小|幹你|靠北|媽的|垃圾|腦殘|fuck|shit|bitch|asshole|idiot|stupid|retard/i;
const okNick = (n) => typeof n === 'string' && n.trim().length >= 1 && n.trim().length <= 12 && !/[<>&"']/.test(n) && !BAD_WORDS.test(n);
const stripBad = (x) => String(x ?? '').replace(/[<>&"']/g, ''); // 濾掉危險字元

const OK_BANK = new Set(['ziyin', 'chengyu', 'mixed']);
const OK_LEVEL = new Set(['國小', '國中']);
const OK_DIFF = new Set(['all', '易', '中', '難']);
function cleanScope(s) {
  if (!s || !OK_BANK.has(s.bank) || !OK_LEVEL.has(s.level)) return null;
  return { bank: s.bank, level: s.level, difficulty: OK_DIFF.has(s.difficulty) ? s.difficulty : 'all' };
}

// CORS 白名單：只回信任的來源，其餘退回主站
const ORIGINS = [
  'https://zizizhuji.vercel.app',
  'https://zizizhuji.pages.dev',
  'https://zizizhuji.netlify.app',
  'http://localhost:8788',
  'http://localhost:8765',
];
const CORS = (request) => ({
  'Access-Control-Allow-Origin': ORIGINS.includes(request.headers.get('origin')) ? request.headers.get('origin') : ORIGINS[1],
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
});

// 輕量限流：每 IP 每 60 秒 cap 次寫入，超過回 429
async function rateLimited(kv, request, scope, cap = 30) {
  const ip = String(request.headers.get('cf-connecting-ip') || '').split(',')[0].trim() || 'unknown';
  const k = `rt:rl:${scope}:${ip}`;
  const n = await kv.incr(k, 60);
  return n > cap;
}

const parse = (x) => {
  if (x == null) return null;
  try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return null; }
};

// 回給前端的 live：一律先拿掉 pin，任何 op 都不外洩主持碼
function pub(live) {
  const { pin, ...rest } = live;
  return rest;
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: CORS(request) });
}

export async function onRequestPost({ request, env }) {
  const kv = kvFor(env.zizizhuji_db);
  const headers = CORS(request);
  try {
    const body = await request.json().catch(() => ({}));
    const { op, code } = body || {};
    if (!okCode(code)) return new Response(JSON.stringify({ ok: 0, error: '班級碼須為 1–16 個中英數字' }), { status: 200, headers });

    if (op === 'start') {
      if (await rateLimited(kv, request, 'livestart', 10)) return new Response(JSON.stringify({ ok: 0, error: '操作太頻繁，請稍候再試' }), { status: 429, headers });
      if (!okPin(body.pin)) return new Response(JSON.stringify({ ok: 0, error: '主持碼須為 4–8 位數字' }), { status: 200, headers });
      const scope = cleanScope(body.scope);
      if (!scope) return new Response(JSON.stringify({ ok: 0, error: '題庫範圍不合規則' }), { status: 200, headers });
      const cur = parse(await kv.get(keyOf(code)));
      if (cur && cur.phase !== 'end') {
        return new Response(JSON.stringify({ ok: 0, error: '這個班級碼已有進行中的隨堂戰況' }), { status: 200, headers });
      }
      const qn = okQn(body.qn) ? body.qn : 10;
      const live = { seed: Math.floor(Math.random() * 1e9), qn, scope, phase: 'lobby', qNo: 0, pin: body.pin };
      await kv.set(keyOf(code), JSON.stringify(live), { ex: TTL });
      await kv.del(rosterKeyOf(code));
      return new Response(JSON.stringify({ ok: 1, live: pub(live) }), { status: 200, headers });
    }

    if (op === 'state') {
      const live = parse(await kv.get(keyOf(code)));
      return new Response(JSON.stringify({ ok: 1, live: live ? pub(live) : null }), { status: 200, headers });
    }

    if (op === 'next' || op === 'end') {
      if (await rateLimited(kv, request, 'livectl', 30)) return new Response(JSON.stringify({ ok: 0, error: '操作太頻繁，請稍候再試' }), { status: 429, headers });
      const live = parse(await kv.get(keyOf(code)));
      if (!live) return new Response(JSON.stringify({ ok: 0, error: '沒有進行中的隨堂戰況' }), { status: 200, headers });
      if (live.pin !== body.pin) return new Response(JSON.stringify({ ok: 0, error: '主持碼不對' }), { status: 200, headers });
      if (op === 'end' || live.qNo >= live.qn) live.phase = 'end';
      else { live.phase = 'q'; live.qNo += 1; }
      await kv.set(keyOf(code), JSON.stringify(live), { ex: TTL });
      return new Response(JSON.stringify({ ok: 1, live: pub(live) }), { status: 200, headers });
    }

    if (op === 'answer') {
      if (await rateLimited(kv, request, 'liveans', 120)) return new Response(JSON.stringify({ ok: 0, error: '操作太頻繁，請稍候再試' }), { status: 429, headers });
      if (!okNick(body.nick)) return new Response(JSON.stringify({ ok: 0, error: '暱稱不合規則' }), { status: 200, headers });
      const qNo = Math.round(Number(body.qNo) || 0);
      if (qNo < 0 || qNo > 20) return new Response(JSON.stringify({ ok: 0, error: 'bad qNo' }), { status: 200, headers });
      const nick = stripBad(body.nick).trim().slice(0, 12);
      const rk = rosterKeyOf(code);
      const rec = parse(await kv.hget(rk, nick)) || { qNo: 0, score: 0, hist: '' };
      if (qNo > rec.qNo) { // 只收新題，qNo<=已記錄一律忽略：防重送灌分
        rec.hist = (rec.hist + '-'.repeat(Math.max(0, qNo - rec.qNo - 1)) + (body.correct ? '1' : '0')).slice(-20);
        rec.qNo = qNo;
        rec.score += body.correct ? 1 : 0;
      }
      await kv.hset(rk, { [nick]: JSON.stringify(rec) });
      await kv.expire(rk, TTL);
      return new Response(JSON.stringify({ ok: 1, score: rec.score }), { status: 200, headers });
    }

    if (op === 'roster') {
      const all = await kv.hgetall(rosterKeyOf(code));
      const list = Object.entries(all || {}).map(([nick, v]) => {
        const d = parse(v) || {};
        return { nick, score: d.score || 0, qNo: d.qNo || 0, hist: d.hist || '' };
      }).sort((a, b) => b.score - a.score);
      return new Response(JSON.stringify({ ok: 1, list }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ ok: 0, error: 'bad op' }), { status: 400, headers });
  } catch (e) {
    return new Response(JSON.stringify({ ok: 0, error: String((e && e.message) || e) }), { status: 500, headers });
  }
}
