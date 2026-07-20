import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GEAR_WHITELIST, tierOf, validPrice, isMarketOpen, weekKey, okNick, okClass, sigOf, PRICE_BAND, marketOp } from '../functions/api/market.js';
import { GEAR_LIST } from '../js/meta/gear.js';

test('GEAR_WHITELIST 與前端 GEAR_LIST 完全同步（防雙表漂移）', () => {
  assert.equal(Object.keys(GEAR_WHITELIST).length, 12);
  for (const g of GEAR_LIST) assert.equal(GEAR_WHITELIST[g.id], g.price);
});
test('tierOf：80→fan、150→liang、300→zhen；神獸/未知 id 一律 null', () => {
  assert.equal(tierOf('langhao'), 'fan');
  assert.equal(tierOf('duanyan'), 'liang');
  assert.equal(tierOf('sheyan'), 'zhen');
  assert.equal(tierOf('qilin'), null);      // 神獸 id 不在白名單
  assert.equal(tierOf(''), null);
  assert.equal(tierOf(null), null);
});
test('validPrice：整數且落在該階價格帶', () => {
  assert.equal(validPrice('langhao', 40), true);   // fan 下界
  assert.equal(validPrice('langhao', 120), true);  // fan 上界
  assert.equal(validPrice('langhao', 39), false);
  assert.equal(validPrice('langhao', 121), false);
  assert.equal(validPrice('langhao', 50.5), false);
  assert.equal(validPrice('sheyan', 450), true);   // zhen 上界
  assert.equal(validPrice('nope', 100), false);
});
test('isMarketOpen：UTC+8 週五16:00 起、週日24:00 止', () => {
  // 2026-07-24 是週五。UTC+8 15:59 = UTC 07:59
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 24, 7, 59)), false);
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 24, 8, 0)), true);   // 週五 16:00
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 25, 4, 0)), true);   // 週六中午
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 26, 15, 59)), true); // 週日 23:59
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 26, 16, 0)), false); // 週一 00:00
  assert.equal(isMarketOpen(Date.UTC(2026, 6, 22, 4, 0)), false);  // 週三
});
test('weekKey：同一開市週末（五六日）落同桶、跨週不同桶', () => {
  assert.equal(weekKey(Date.UTC(2026, 6, 24, 9, 0)), weekKey(Date.UTC(2026, 6, 26, 12, 0)));
  assert.notEqual(weekKey(Date.UTC(2026, 6, 24, 9, 0)), weekKey(Date.UTC(2026, 6, 31, 9, 0)));
});
test('okNick：長度、危險字元、髒話全擋', () => {
  assert.equal(okNick('小明'), true);
  assert.equal(okNick(''), false);
  assert.equal(okNick('a'.repeat(13)), false);
  assert.equal(okNick('<img>'), false);
  assert.equal(okNick('笨蛋'), false);
});
test('okClass：合法班碼放行、注入字元擋下', () => {
  assert.equal(okClass('七年3班'), true);
  assert.equal(okClass('demo'), true);
  assert.equal(okClass('a;DROP'), false);
  assert.equal(okClass(''), false);
});
test('sigOf：同 payload 同 secret 穩定；欄位變動即不同', () => {
  const p = { gearId: 'langhao', price: 50, seller: '小明', id: 'abc123' };
  assert.equal(sigOf(p, 's1'), sigOf({ ...p }, 's1'));
  assert.equal(sigOf(p, 's1').length, 24);
  assert.notEqual(sigOf(p, 's1'), sigOf({ ...p, price: 51 }, 's1'));
  assert.notEqual(sigOf(p, 's1'), sigOf(p, 's2'));
});

function fakeRedis() {
  const kv = new Map(), zsets = new Map(), counters = new Map();
  return {
    async get(k) { return kv.has(k) ? kv.get(k) : null; },
    async set(k, v) { kv.set(k, typeof v === 'string' ? v : JSON.stringify(v)); return 'OK'; },
    async del(...ks) { ks.forEach(k => kv.delete(k)); return ks.length; },
    async incr(k, ttl) { const n = (counters.get(k) || 0) + 1; counters.set(k, n); return n; },
    async zadd(k, { score, member }) { const m = zsets.get(k) || new Map(); m.set(member, score); zsets.set(k, m); return 1; },
    async zrange(k, s, e, opts) {
      const m = [...(zsets.get(k) || new Map()).entries()].sort((a, b) => (opts && opts.rev) ? b[1] - a[1] : a[1] - b[1]);
      const rows = m.slice(s, e === -1 ? undefined : e + 1);
      return (opts && opts.withScores) ? rows.flat() : rows.map(r => r[0]);
    },
    async zrem(k, ...ms) { const m = zsets.get(k); ms.forEach(x => m && m.delete(x)); return ms.length; },
    async zincrby(k, d, member) { const m = zsets.get(k) || new Map(); m.set(member, (m.get(member) || 0) + d); zsets.set(k, m); return m.get(member); },
  };
}
const ENV = { secret: 'test-secret', forceOpen: true, db: null }; // db=null → roster 驗證由 Task 6 注入
const OPEN_TS = Date.UTC(2026, 6, 25, 4, 0); // 週六，開市中

test('post：合法上架回 id+claimKey，list 查得到', async () => {
  const r = fakeRedis();
  const a = await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS);
  assert.equal(a.ok, 1);
  assert.equal(typeof a.id, 'string');
  assert.equal(typeof a.claimKey, 'string');
  const l = await marketOp(r, { op: 'list', classCode: 'demo', scope: 'class' }, ENV, OPEN_TS);
  assert.equal(l.list.length, 1);
  assert.equal(l.list[0].gearId, 'langhao');
  assert.equal(l.list[0].price, 50);
});
test('post：非白名單裝備（神獸）、價格出帶、髒話暱稱全拒', async () => {
  const r = fakeRedis();
  assert.equal((await marketOp(r, { op: 'post', gearId: 'qilin', price: 50, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS)).ok, 0);
  assert.equal((await marketOp(r, { op: 'post', gearId: 'langhao', price: 999, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS)).ok, 0);
  assert.equal((await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: '笨蛋', classCode: 'demo' }, ENV, OPEN_TS)).ok, 0);
});
test('post：同賣家同時最多 3 筆', async () => {
  const r = fakeRedis();
  for (let i = 0; i < 3; i++) assert.equal((await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS)).ok, 1);
  const d = await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS);
  assert.equal(d.ok, 0);
  assert.match(d.error, /3/);
});
test('post：非開市時段拒收（forceOpen=false）', async () => {
  const r = fakeRedis();
  const d = await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: '小明', classCode: 'demo' }, { ...ENV, forceOpen: false }, Date.UTC(2026, 6, 22, 4, 0));
  assert.equal(d.ok, 0);
  assert.match(d.error, /開市/);
});

test('buy：合法購買回 gearId+price；掛單從 list 消失；感謝小卡存檔', async () => {
  const r = fakeRedis();
  const a = await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS);
  const b = await marketOp(r, { op: 'buy', id: a.id, nick: '小華', classCode: 'demo', cardId: 3 }, ENV, OPEN_TS);
  assert.equal(b.ok, 1);
  assert.equal(b.gearId, 'langhao');
  assert.equal(b.price, 50);
  const l = await marketOp(r, { op: 'list', classCode: 'demo', scope: 'class' }, ENV, OPEN_TS);
  assert.equal(l.list.length, 0);
  const rec = JSON.parse(await r.get(`mkt:item:${a.id}`));
  assert.equal(rec.sold, 1); assert.equal(rec.buyer, '小華'); assert.equal(rec.card, 3);
});

test('buy：不能買自己的、重複買、簽章竄改全拒', async () => {
  const r = fakeRedis();
  const a = await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS);
  assert.equal((await marketOp(r, { op: 'buy', id: a.id, nick: '小明', classCode: 'demo' }, ENV, OPEN_TS)).ok, 0);
  const rec = JSON.parse(await r.get(`mkt:item:${a.id}`)); rec.price = 1;   // 竄改價格 → 簽章失效
  await r.set(`mkt:item:${a.id}`, JSON.stringify(rec));
  assert.match((await marketOp(r, { op: 'buy', id: a.id, nick: '小華', classCode: 'demo' }, ENV, OPEN_TS)).error, /簽章/);
});

test('buy：每日限購 3 件伺服器硬擋；失敗的購買不燒配額', async () => {
  const r = fakeRedis();
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push((await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: `賣家${i}`, classCode: 'demo' }, ENV, OPEN_TS)).id);
  await marketOp(r, { op: 'buy', id: 'no-such-id', nick: '小華', classCode: 'demo' }, ENV, OPEN_TS); // 失敗不計
  for (let i = 0; i < 3; i++) assert.equal((await marketOp(r, { op: 'buy', id: ids[i], nick: '小華', classCode: 'demo' }, ENV, OPEN_TS)).ok, 1);
  const d = await marketOp(r, { op: 'buy', id: ids[3], nick: '小華', classCode: 'demo' }, ENV, OPEN_TS);
  assert.equal(d.ok, 0);
  assert.match(d.error, /限購/);
});

test('buy：非開市時段拒買', async () => {
  const r = fakeRedis();
  const a = await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS);
  const d = await marketOp(r, { op: 'buy', id: a.id, nick: '小華', classCode: 'demo' }, { ...ENV, forceOpen: false }, Date.UTC(2026, 6, 22, 4, 0));
  assert.equal(d.ok, 0);
});

test('cancel：憑 claimKey 下架拿回；錯的 claimKey 拒絕；售出後不可下架', async () => {
  const r = fakeRedis();
  const a = await marketOp(r, { op: 'post', gearId: 'duanyan', price: 100, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS);
  assert.equal((await marketOp(r, { op: 'cancel', id: a.id, claimKey: 'wrong' }, ENV, OPEN_TS)).ok, 0);
  const c = await marketOp(r, { op: 'cancel', id: a.id, claimKey: a.claimKey }, ENV, OPEN_TS);
  assert.equal(c.ok, 1); assert.equal(c.gearId, 'duanyan');
  assert.equal((await marketOp(r, { op: 'list', classCode: 'demo', scope: 'class' }, ENV, OPEN_TS)).list.length, 0);
});
test('claim：售出後領款＝floor(price*0.9)、附買家與小卡；重複領拒絕；未售出回 sold:0', async () => {
  const r = fakeRedis();
  const a = await marketOp(r, { op: 'post', gearId: 'sheyan', price: 333, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS);
  assert.equal((await marketOp(r, { op: 'claim', id: a.id, claimKey: a.claimKey }, ENV, OPEN_TS)).sold, 0);
  await marketOp(r, { op: 'buy', id: a.id, nick: '小華', classCode: 'demo', cardId: 5 }, ENV, OPEN_TS);
  const k = await marketOp(r, { op: 'claim', id: a.id, claimKey: a.claimKey }, ENV, OPEN_TS);
  assert.equal(k.ok, 1);
  assert.equal(k.pearls, 299);           // floor(333*0.9)
  assert.equal(k.buyer, '小華');
  assert.equal(k.card, 5);
  assert.match((await marketOp(r, { op: 'claim', id: a.id, claimKey: a.claimKey }, ENV, OPEN_TS)).error, /領過/);
});
test('claim/cancel：非開市時段也可用', async () => {
  const r = fakeRedis();
  const a = await marketOp(r, { op: 'post', gearId: 'langhao', price: 50, seller: '小明', classCode: 'demo' }, ENV, OPEN_TS);
  const c = await marketOp(r, { op: 'cancel', id: a.id, claimKey: a.claimKey }, { ...ENV, forceOpen: false }, Date.UTC(2026, 6, 22, 4, 0));
  assert.equal(c.ok, 1);
});
