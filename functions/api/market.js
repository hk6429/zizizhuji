// 翰墨集市後端 — 玩家間掛單交易（只交易文房四寶裝備，神獸不可交易）。
// 防作弊：白名單驗貨＋HMAC 整筆簽章（MKT_HMAC_SECRET）＋IP 限流；D1 key 一律 mkt: 前綴。
import { createHmac, randomBytes } from 'node:crypto';
import { kvFor } from './_kv.js';

export const GEAR_WHITELIST = { langhao: 80, zihao: 150, huying: 300, songyan: 150, youyan: 80, huimo: 300, chengxin: 80, yuban: 150, xuanzhi: 300, duanyan: 150, sheyan: 300, taoyan: 80 };
export const TIER_OF_PRICE = { 80: 'fan', 150: 'liang', 300: 'zhen' };
export const TIER_LABEL = { fan: '凡品', liang: '良品', zhen: '珍品' };
export const PRICE_BAND = { fan: [40, 120], liang: [75, 225], zhen: [150, 450] };

export function tierOf(gearId) {
  const base = GEAR_WHITELIST[gearId];
  return base ? TIER_OF_PRICE[base] : null;
}
export function validPrice(gearId, price) {
  const tier = tierOf(gearId);
  if (!tier || !Number.isInteger(price)) return false;
  const [lo, hi] = PRICE_BAND[tier];
  return price >= lo && price <= hi;
}
// 台灣時區固定 UTC+8（無日光節約）：週五 16:00 起至週日 24:00
export function isMarketOpen(nowMs = Date.now()) {
  const t = new Date(nowMs + 8 * 3600 * 1000);           // 位移後以 UTC getter 讀台灣牆鐘
  const day = t.getUTCDay(), hh = t.getUTCHours();
  if (day === 6 || day === 0) return true;               // 週六、週日整天
  return day === 5 && hh >= 16;                          // 週五 16:00 起
}
// 珍品限量的週桶：以該開市週末的「週五」日期為桶名，五六日共用同桶
export function weekKey(nowMs = Date.now()) {
  const t = new Date(nowMs + 8 * 3600 * 1000);
  const day = t.getUTCDay();
  const back = day === 5 ? 0 : day === 6 ? 1 : day === 0 ? 2 : (day + 2) % 7; // 回推到本檔期週五
  const fri = new Date(t.getTime() - back * 86400 * 1000);
  return fri.toISOString().slice(0, 10);
}
const BAD_WORDS = /笨蛋|白癡|白痴|智障|廢物|去死|王八蛋|三小|幹你|靠北|媽的|滾蛋|垃圾|腦殘|廢咖|fuck|shit|bitch|asshole|idiot|stupid|retard/i;
export function okNick(n) {
  return typeof n === 'string' && n.trim().length >= 1 && n.trim().length <= 12 && !/[<>&"']/.test(n) && !BAD_WORDS.test(n);
}
export function okClass(c) {
  return typeof c === 'string' && /^[\w一-鿿]{1,20}$/.test(c);
}
export function sigOf(p, secret) {
  const canon = JSON.stringify({ gearId: p.gearId, price: p.price, seller: p.seller, id: p.id }); // 欄序固定
  return createHmac('sha256', secret).update(canon).digest('hex').slice(0, 24);
}

const ITEM = (id) => `mkt:item:${id}`;
const ZCLASS = (c) => `mkt:z:c:${c}`;
const ZPUB = 'mkt:z:pub';
const ITEM_TTL = 7 * 86400;
const MAX_LISTINGS = 3;
export const memberOf = (rec) => JSON.stringify({ id: rec.id, gearId: rec.gearId, seller: rec.seller, price: rec.price, ts: rec.ts, reserved: rec.reserveFor ? 1 : 0, pub: rec.pub ? 1 : 0 });
const parse = (x) => { try { return typeof x === 'string' ? JSON.parse(x) : x; } catch { return null; } };

export async function marketOp(redis, body, ctx, nowMs = Date.now()) {
  const { op } = body || {};
  const open = ctx.forceOpen || isMarketOpen(nowMs);

  if (op === 'list') {
    const scope = body.scope === 'pub' ? 'pub' : 'class';
    if (scope === 'class' && !okClass(body.classCode)) return { ok: 0, error: '班級代碼不合法' };
    const raw = await redis.zrange(scope === 'pub' ? ZPUB : ZCLASS(body.classCode), 0, 49);
    return { ok: 1, list: raw.map(parse).filter(Boolean) };
  }

  if (op === 'post') {
    if (!open) return { ok: 0, error: '集市尚未開市（每週五 16:00 至週日夜間）' };
    const { gearId, seller, classCode } = body;
    const price = Math.round(Number(body.price) || 0);
    if (!tierOf(gearId)) return { ok: 0, error: '這件寶物不在集市可交易清單（神獸與夥伴不是商品）' };
    if (!validPrice(gearId, price)) { const [lo, hi] = PRICE_BAND[tierOf(gearId)]; return { ok: 0, error: `${TIER_LABEL[tierOf(gearId)]}定價要在 ${lo}–${hi} 字珠` }; }
    if (!okNick(seller)) return { ok: 0, error: '暱稱不合法' };
    if (!okClass(classCode)) return { ok: 0, error: '請先在積分競技設定班級代碼' };
    const mine = (await redis.zrange(ZCLASS(classCode), 0, 199)).map(parse).filter(x => x && x.seller === seller.trim());
    if (mine.length >= MAX_LISTINGS) return { ok: 0, error: `最多同時掛 ${MAX_LISTINGS} 筆` };
    const id = randomBytes(6).toString('hex');
    const claimKey = randomBytes(12).toString('hex');
    const rec = { id, gearId, seller: seller.trim(), price, ts: nowMs, classCode, pub: body.pub ? 1 : 0, reserveFor: '' };
    const sig = sigOf({ gearId, price, seller: rec.seller, id }, ctx.secret);
    await redis.set(ITEM(id), JSON.stringify({ ...rec, claimKey, sig, sold: 0, claimed: 0, card: 0 }), { ex: ITEM_TTL });
    await redis.zadd(ZCLASS(classCode), { score: price, member: memberOf(rec) });
    if (rec.pub) await redis.zadd(ZPUB, { score: price, member: memberOf(rec) });
    return { ok: 1, id, claimKey };
  }
  return { ok: 0, error: 'bad op' };
}

async function rateLimited(request, redis) {
  const ip = String(request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  return (await redis.incr(`mkt:rl:${ip}`, 60)) > 30;
}
const ORIGINS = ['https://zizizhuji.vercel.app', 'https://zizizhuji.pages.dev', 'https://zizizhuji.netlify.app', 'http://localhost:8788', 'http://localhost:8765'];

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[1],
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json',
  };
}
export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}
export async function onRequestPost({ request, env }) {
  const headers = corsHeaders(request.headers.get('origin'));
  const redis = kvFor(env.zizizhuji_db);
  let body;
  try { body = await request.json(); } catch { body = {}; }
  try {
    if ((body || {}).op !== 'list' && (await rateLimited(request, redis))) {
      return new Response(JSON.stringify({ error: '操作太頻繁，請稍候再試' }), { status: 429, headers });
    }
    const ctx = { secret: env.MKT_HMAC_SECRET || 'mkt-dev', forceOpen: env.MKT_FORCE_OPEN === '1', db: env.zizizhuji_db };
    return new Response(JSON.stringify(await marketOp(redis, body, ctx)), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e && e.message) || e) }), { status: 500, headers });
  }
}
