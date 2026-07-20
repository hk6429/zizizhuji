// 翰墨集市後端 — 玩家間掛單交易（只交易文房四寶裝備，神獸不可交易）。
// 防作弊：白名單驗貨＋HMAC 整筆簽章（MKT_HMAC_SECRET）＋IP 限流；D1 key 一律 mkt: 前綴。
import { createHmac } from 'node:crypto';

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
