// 即時對戰房間 — 4 位數房號、輪詢制（回合答題 1–2 秒延遲夠用）
// POST { op:'create', snap }                    → 開房，回 { code, seed }
// POST { op:'join', code, snap }                → 加入，回 { seed, scope, opp }
// POST { op:'push', code, role, state }         → 寫入自己的對戰狀態
// POST { op:'poll', code, role }                → 讀對方狀態（附房間 meta）
// —— 非同步挑戰書（不用同時在線）——
// POST { op:'challenge', seed, scope, nick, score }   → 發戰帖，回 { code }（6 碼，7 天有效）
// POST { op:'accept', code }                          → 領戰帖，回 { seed, scope, challenger, score }
// POST { op:'challengeResult', code, nick, score }    → 回報應戰成績，回 { ok, challenger, accepter }
// 移植自 vocab-duel functions/api/room.js（create/join/push/poll＋Task 8 追加 challenge 三段）。
import { kvFor } from './_kv.js';

const TTL = 600; // 房間 10 分鐘
const CH_TTL = 7 * 86400; // 挑戰書 7 天
const SEASON_TTL = 100 * 86400; // 賽季榜 100 天（跨季可回顧上季榜）
const keyOf = (code) => `rt:room:${code}`;
const chKey = (code) => `rt:ch:${code}`;
const seasonKeyOf = (k) => `rt:season:${k}`;
const currentSeasonKey = () => new Date().toISOString().slice(0, 7); // 伺服器自算，不信任 client
const okChCode = (c) => typeof c === 'string' && /^[A-Z0-9]{6}$/.test(String(c).trim().toUpperCase());
const genChCode = () => {
  const cs = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 避開易混淆字元
  let s = '';
  for (let i = 0; i < 6; i++) s += cs[Math.floor(Math.random() * cs.length)];
  return s;
};
const clamp = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
// 暱稱黑名單：常見中英文辱罵字詞（非窮舉），暱稱會顯示在對戰畫面，擋掉明顯攻擊性暱稱
const BAD_WORDS = /笨蛋|白癡|智障|廢物|去死|三小|幹你|靠北|媽的|垃圾|腦殘|fuck|shit|bitch|asshole|idiot|stupid|retard/i;
const okNick = (n) => typeof n === 'string' && n.trim().length >= 1 && n.trim().length <= 12 && !/[<>&"']/.test(n) && !BAD_WORDS.test(n);
const okCode = (c) => typeof c === 'string' && /^\d{4}$/.test(c);
const okRole = (r) => r === 'p1' || r === 'p2';

const OK_BANK = new Set(['ziyin', 'chengyu', 'mixed']);
const OK_LEVEL = new Set(['國小', '國中']);
const OK_DIFF = new Set(['all', '易', '中', '難']);

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

const stripBad = (x) => String(x ?? '').replace(/[<>&"']/g, ''); // 濾掉危險字元

function cleanScope(s) {
  if (!s || !OK_BANK.has(s.bank) || !OK_LEVEL.has(s.level)) return null;
  return { bank: s.bank, level: s.level, difficulty: OK_DIFF.has(s.difficulty) ? s.difficulty : 'all' };
}

function cleanSnap(s) {
  if (!s || !okNick(s.nick)) return null;
  const nick = stripBad(s.nick).trim();
  const scope = cleanScope(s.scope);
  if (!nick || !scope) return null;
  return {
    nick,
    petId: typeof s.petId === 'string' ? s.petId.slice(0, 16) : '',
    petName: (typeof s.petName === 'string' ? stripBad(s.petName).slice(0, 8) : '') || '墨靈',
    lv: clamp(s.lv, 15) || 1,
    hp: clamp(s.hp, 400) || 200,
    scope,
  };
}

function cleanState(s) {
  if (!s) return null;
  return {
    dmg: clamp(s.dmg, 99999),   // 累計輸出傷害（攻擊方權威）
    round: clamp(s.round, 40),
    combo: clamp(s.combo, 40),
    correct: clamp(s.correct, 40),
    done: s.done ? 1 : 0,
    hb: Date.now(),
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: CORS(request) });
}

export async function onRequestPost({ request, env }) {
  const kv = kvFor(env.zizizhuji_db);
  const headers = CORS(request);
  try {
    const body = await request.json().catch(() => ({}));
    const { op } = body || {};

    // 寫入操作限流（poll 為讀取不限；push 頻率高，用較寬的獨立桶）
    if (op === 'create' || op === 'join') {
      if (await rateLimited(kv, request, 'room')) return new Response(JSON.stringify({ error: '操作太頻繁，請稍候再試' }), { status: 429, headers });
    }

    if (op === 'create') {
      const snap = cleanSnap(body.snap);
      if (!snap) return new Response(JSON.stringify({ error: 'bad snap' }), { status: 400, headers });
      // 找一個沒人用的 4 位數房號（最多試 8 次）
      let code = '';
      for (let i = 0; i < 8; i++) {
        const c = String(1000 + Math.floor(Math.random() * 9000));
        if (!(await kv.exists(keyOf(c)))) { code = c; break; }
      }
      if (!code) return new Response(JSON.stringify({ error: 'no room' }), { status: 500, headers });
      const seed = Math.floor(Math.random() * 1e9);
      await kv.set(keyOf(code), JSON.stringify({ seed, scope: snap.scope }), { ex: TTL });
      await kv.set(`${keyOf(code)}:p1`, JSON.stringify({ snap, state: null, hb: Date.now() }), { ex: TTL });
      return new Response(JSON.stringify({ ok: 1, code, seed }), { status: 200, headers });
    }

    if (op === 'join') {
      const { code } = body;
      const snap = cleanSnap(body.snap);
      if (!okCode(code) || !snap) return new Response(JSON.stringify({ error: 'bad req' }), { status: 400, headers });
      const meta = await kv.get(keyOf(code));
      if (!meta) return new Response(JSON.stringify({ ok: 0, error: '房間不存在或已過期' }), { status: 200, headers });
      if (await kv.exists(`${keyOf(code)}:p2`)) return new Response(JSON.stringify({ ok: 0, error: '房間已滿' }), { status: 200, headers });
      const p1 = await kv.get(`${keyOf(code)}:p1`);
      await kv.set(`${keyOf(code)}:p2`, JSON.stringify({ snap, state: null, hb: Date.now() }), { ex: TTL });
      const m = typeof meta === 'string' ? JSON.parse(meta) : meta;
      const o = typeof p1 === 'string' ? JSON.parse(p1) : p1;
      return new Response(JSON.stringify({ ok: 1, seed: m.seed, scope: m.scope, opp: o ? o.snap : null }), { status: 200, headers });
    }

    if (op === 'push') {
      if (await rateLimited(kv, request, 'push', 90)) return new Response(JSON.stringify({ error: '操作太頻繁，請稍候再試' }), { status: 429, headers });
      const { code, role } = body;
      const state = cleanState(body.state);
      if (!okCode(code) || !okRole(role) || !state) return new Response(JSON.stringify({ error: 'bad req' }), { status: 400, headers });
      const cur = await kv.get(`${keyOf(code)}:${role}`);
      const obj = cur ? (typeof cur === 'string' ? JSON.parse(cur) : cur) : { snap: null };
      obj.state = state; obj.hb = Date.now();
      await kv.set(`${keyOf(code)}:${role}`, JSON.stringify(obj), { ex: TTL });
      return new Response(JSON.stringify({ ok: 1 }), { status: 200, headers });
    }

    if (op === 'poll') {
      const { code, role } = body;
      if (!okCode(code) || !okRole(role)) return new Response(JSON.stringify({ error: 'bad req' }), { status: 400, headers });
      const other = role === 'p1' ? 'p2' : 'p1';
      const [meta, raw] = await Promise.all([kv.get(keyOf(code)), kv.get(`${keyOf(code)}:${other}`)]);
      if (!meta) return new Response(JSON.stringify({ ok: 0, error: '房間已過期' }), { status: 200, headers });
      const o = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
      return new Response(JSON.stringify({
        ok: 1,
        opp: o ? { snap: o.snap, state: o.state, hb: o.hb } : null,
        now: Date.now(),
      }), { status: 200, headers });
    }

    if (op === 'challenge') {
      if (await rateLimited(kv, request, 'room')) return new Response(JSON.stringify({ error: '操作太頻繁，請稍候再試' }), { status: 429, headers });
      const { seed, nick, score } = body;
      const scope = cleanScope(body.scope);
      if (!okNick(nick) || !scope) return new Response(JSON.stringify({ error: 'bad req' }), { status: 400, headers });
      const rec = {
        seed: clamp(seed, 1e9),
        scope,
        nick: stripBad(nick).trim().slice(0, 12),
        score: clamp(score, 999999),
        ts: Date.now(),
      };
      if (!rec.nick) return new Response(JSON.stringify({ error: 'bad req' }), { status: 400, headers });
      // 找一個沒人用的 6 碼戰帖號（最多試 8 次）
      let code = '';
      for (let i = 0; i < 8; i++) {
        const c = genChCode();
        if (!(await kv.exists(chKey(c)))) { code = c; break; }
      }
      if (!code) return new Response(JSON.stringify({ error: 'no code' }), { status: 500, headers });
      await kv.set(chKey(code), JSON.stringify(rec), { ex: CH_TTL });
      return new Response(JSON.stringify({ ok: 1, code }), { status: 200, headers });
    }

    if (op === 'accept') {
      const code = String(body.code || '').trim().toUpperCase();
      if (!okChCode(code)) return new Response(JSON.stringify({ ok: 0, error: '戰帖碼格式不對' }), { status: 200, headers });
      const raw = await kv.get(chKey(code));
      if (!raw) return new Response(JSON.stringify({ ok: 0, error: '戰帖不存在或已過期' }), { status: 200, headers });
      const c = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return new Response(JSON.stringify({ ok: 1, seed: c.seed, scope: c.scope, challenger: c.nick, score: c.score }), { status: 200, headers });
    }

    if (op === 'challengeResult') {
      if (await rateLimited(kv, request, 'room')) return new Response(JSON.stringify({ error: '操作太頻繁，請稍候再試' }), { status: 429, headers });
      const code = String(body.code || '').trim().toUpperCase();
      const { nick, score } = body;
      if (!okChCode(code) || !okNick(nick)) return new Response(JSON.stringify({ ok: 0, error: '資料不完整' }), { status: 200, headers });
      const raw = await kv.get(chKey(code));
      if (!raw) return new Response(JSON.stringify({ ok: 0, error: '戰帖不存在或已過期' }), { status: 200, headers });
      const c = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const accepter = { nick: stripBad(nick).trim().slice(0, 12), score: clamp(score, 999999), ts: Date.now() };
      c.accepter = accepter; // 保留最近一次應戰結果
      await kv.set(chKey(code), JSON.stringify(c), { ex: CH_TTL });
      return new Response(JSON.stringify({
        ok: 1,
        challenger: { nick: c.nick, score: c.score },
        accepter: { nick: accepter.nick, score: accepter.score },
      }), { status: 200, headers });
    }

    if (op === 'seasonAdd') {
      if (await rateLimited(kv, request, 'room')) return new Response(JSON.stringify({ error: '操作太頻繁，請稍候再試' }), { status: 429, headers });
      const { nick } = body;
      if (!okNick(nick)) return new Response(JSON.stringify({ error: 'bad req' }), { status: 400, headers });
      const pts = clamp(body.pts, 20); // 單場上限 20 分
      const key = seasonKeyOf(currentSeasonKey());
      const total = await kv.zincrby(key, pts, stripBad(nick).trim().slice(0, 12));
      await kv.expire(key, SEASON_TTL);
      return new Response(JSON.stringify({ ok: 1, total }), { status: 200, headers });
    }

    if (op === 'seasonTop') {
      const season = currentSeasonKey();
      const flat = await kv.zrange(seasonKeyOf(season), 0, 9, { rev: true, withScores: true });
      const top = [];
      for (let i = 0; i < flat.length; i += 2) top.push({ nick: flat[i], pts: Number(flat[i + 1]) });
      return new Response(JSON.stringify({ ok: 1, season, top }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'bad op' }), { status: 400, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), { status: 500, headers });
  }
}
