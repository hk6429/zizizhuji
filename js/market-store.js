// M? 翰墨集市 — 前端邏輯層。純邏輯零 DOM，全部可注入 storage 測試。
// localStorage key：zz_mkt_claims（我方掛單留存，領款用）/ zz_mkt_buys（今日購買計數）/ zz_mkt_ever（曾經持有留痕）。
import { GEAR_LIST } from './meta/gear.js';
import { earnPearls, spendPearls } from './meta/economy.js';

// 同共用契約（見 functions/api/market.js）
export const TIER_OF_PRICE = { 80: 'fan', 150: 'liang', 300: 'zhen' };
export const TIER_LABEL = { fan: '凡品', liang: '良品', zhen: '珍品' };
export const PRICE_BAND = { fan: [40, 120], liang: [75, 225], zhen: [150, 450] };
export const TIER_GRADE = { fan: 'C', liang: 'B', zhen: 'A' };
export const THANKS_CARDS = [
  '謝謝惠顧，祝你連對長紅！',
  '感謝支持，這件寶物就交給你了！',
  '成交愉快，願你場場豐收！',
  '謝謝厚愛，一起把字練好！',
  '感恩交易，下次集市再會！',
  '謝謝你，這份心意收下了！',
];

export const DAILY_BUY_CAP = 3;

export function tierOf(gearId) {
  const gear = GEAR_LIST.find(g => g.id === gearId);
  return gear ? TIER_OF_PRICE[gear.price] : null;
}

export function bandOf(gearId) {
  const tier = tierOf(gearId);
  return tier ? PRICE_BAND[tier] : null;
}

// 與 functions/api/market.js 同步，改一邊必改另一邊，test/market-store.test.mjs 有交叉驗證
// 台灣時區固定 UTC+8（無日光節約）：週五 16:00 起至週日 24:00
export function isMarketOpen(nowMs = Date.now()) {
  const t = new Date(nowMs + 8 * 3600 * 1000);
  const day = t.getUTCDay(), hh = t.getUTCHours();
  if (day === 6 || day === 0) return true;
  return day === 5 && hh >= 16;
}

const WEEKDAY_NAME = ['日', '一', '二', '三', '四', '五', '六'];

export function nextOpenText(nowMs = Date.now()) {
  if (isMarketOpen(nowMs)) return '集市營業中';
  let t = nowMs;
  for (let i = 0; i < 8 * 24; i++) {
    t += 3600 * 1000;
    if (isMarketOpen(t)) {
      const d = new Date(t + 8 * 3600 * 1000);
      return `週${WEEKDAY_NAME[d.getUTCDay()]} ${String(d.getUTCHours()).padStart(2, '0')}:00 開市`;
    }
  }
  return '週五 16:00 開市';
}

export function sellableGear(meta) {
  return (meta.gear.owned || [])
    .map(id => GEAR_LIST.find(g => g.id === id))
    .filter(Boolean)
    .map(g => {
      const tier = tierOf(g.id);
      return { id: g.id, name: g.name, price: g.price, tier, tierLabel: TIER_LABEL[tier], grade: TIER_GRADE[tier] };
    });
}

export function removeGear(meta, gearId) {
  if (!meta.gear.owned.includes(gearId)) return { meta, ok: false };
  meta.gear.owned = meta.gear.owned.filter(id => id !== gearId);
  meta.gear.loadout = meta.gear.loadout.filter(id => id !== gearId);
  return { meta, ok: true };
}

export function grantGear(meta, gearId) {
  if (meta.gear.owned.includes(gearId)) return { meta, ok: false, reason: 'owned' };
  meta.gear.owned.push(gearId);
  return { meta, ok: true, reason: null };
}

export function settleSale(meta, pearls, today) {
  const { meta: m, earned } = earnPearls(meta, pearls, 'market-sale', today);
  return { meta: m, earned };
}

export function payForBuy(meta, price) {
  const { meta: m, ok } = spendPearls(meta, price, 'market-buy');
  return { meta: m, ok };
}

// ---- storage 注入（比照 js/meta/store.js 手法）----
function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

let injectedBackend = null;
const memoryFallback = createMemoryStorage();

export function setStorageBackend(backend) {
  injectedBackend = backend;
}

function getStorage() {
  if (injectedBackend) return injectedBackend;
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch { /* 隱私模式存取 localStorage 本身就可能 throw */ }
  return memoryFallback;
}

function readJson(key, fallback) {
  try {
    const raw = getStorage().getItem(key);
    if (!raw) return fallback;
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    getStorage().setItem(key, JSON.stringify(value));
  } catch { /* 隱私模式/容量爆滿等，忽略 */ }
}

const CLAIMS_KEY = 'zz_mkt_claims';
const BUYS_KEY = 'zz_mkt_buys';
const EVER_KEY = 'zz_mkt_ever';
const EVER_MAX = 100;

function dayStr(nowMs) {
  return new Date(nowMs + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

export function getClaims() {
  return readJson(CLAIMS_KEY, []);
}

export function addClaim(claim) {
  const claims = getClaims();
  claims.push(claim);
  writeJson(CLAIMS_KEY, claims);
  return claims;
}

export function removeClaim(id) {
  const claims = getClaims().filter(c => c.id !== id);
  writeJson(CLAIMS_KEY, claims);
  return claims;
}

export function buysToday(nowMs = Date.now()) {
  const rec = readJson(BUYS_KEY, { date: '', n: 0 });
  return rec.date === dayStr(nowMs) ? rec.n : 0;
}

export function bumpBuys(nowMs = Date.now()) {
  const today = dayStr(nowMs);
  const rec = readJson(BUYS_KEY, { date: '', n: 0 });
  const n = rec.date === today ? rec.n + 1 : 1;
  writeJson(BUYS_KEY, { date: today, n });
  return n;
}

export function getEverOwned() {
  return readJson(EVER_KEY, []);
}

export function recordEverOwned(entry) {
  const list = getEverOwned();
  list.unshift(entry);
  writeJson(EVER_KEY, list.slice(0, EVER_MAX));
  return list;
}
