import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tierOf, bandOf, isMarketOpen, sellableGear, removeGear, grantGear, settleSale, payForBuy, setStorageBackend, getClaims, addClaim, removeClaim, buysToday, bumpBuys, recordEverOwned, getEverOwned, DAILY_BUY_CAP, THANKS_CARDS } from '../js/market-store.js';
import * as api from '../functions/api/market.js';
import { defaultMeta } from '../js/meta/store.js';
import { CAP_EXEMPT_REASONS } from '../js/meta/economy.js';

function memStorage() { const m = new Map(); return { getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }

test('前後端規則同步：tierOf/PRICE_BAND/isMarketOpen 交叉一致', () => {
  for (const id of ['langhao', 'duanyan', 'sheyan', 'nope']) assert.equal(tierOf(id), api.tierOf(id));
  for (const ts of [Date.UTC(2026,6,24,7,59), Date.UTC(2026,6,24,8,0), Date.UTC(2026,6,26,15,59), Date.UTC(2026,6,26,16,0)]) assert.equal(isMarketOpen(ts), api.isMarketOpen(ts));
  assert.deepEqual(bandOf('sheyan'), api.PRICE_BAND.zhen);
});
test('sellableGear 只列已擁有；removeGear 同步清 loadout；grantGear 擋重複', () => {
  const meta = defaultMeta();
  meta.gear.owned = ['langhao', 'sheyan']; meta.gear.loadout = ['langhao'];
  assert.deepEqual(sellableGear(meta).map(g => g.id), ['langhao', 'sheyan']);
  assert.equal(removeGear(meta, 'langhao').ok, true);
  assert.deepEqual(meta.gear.owned, ['sheyan']);
  assert.deepEqual(meta.gear.loadout, []);
  assert.equal(grantGear(meta, 'sheyan').reason, 'owned');
  assert.equal(grantGear(meta, 'langhao').ok, true);
});
test('settleSale 走 market-sale 且豁免每日上限；payForBuy 餘額不足擋下', () => {
  assert.equal(CAP_EXEMPT_REASONS.has('market-sale'), true);
  const meta = defaultMeta();
  meta.pearls.earnedToday = 120; meta.pearls.earnedDate = '2026-07-25';
  const s = settleSale(meta, 45, '2026-07-25');
  assert.equal(s.earned, 45);                       // 不被 120 上限吃掉
  assert.equal(meta.pearls.balance, 45);
  assert.equal(payForBuy(meta, 999).ok, false);
  assert.equal(payForBuy(meta, 40).ok, true);
  assert.equal(meta.pearls.balance, 5);
});
test('claims / buysToday / everOwned 持久化（注入 storage）', () => {
  setStorageBackend(memStorage());
  assert.deepEqual(getClaims(), []);
  addClaim({ id: 'x1', claimKey: 'k', gearId: 'langhao', price: 50 });
  assert.equal(getClaims().length, 1);
  removeClaim('x1');
  assert.deepEqual(getClaims(), []);
  const t = Date.UTC(2026, 6, 25, 4, 0);
  assert.equal(buysToday(t), 0);
  bumpBuys(t); bumpBuys(t);
  assert.equal(buysToday(t), 2);
  assert.equal(buysToday(t + 86400 * 1000), 0);     // 跨日歸零
  recordEverOwned({ gearId: 'langhao', dir: 'sold', peer: '小華', ts: t });
  assert.equal(getEverOwned()[0].dir, 'sold');
  assert.equal(THANKS_CARDS.length, 6);
});
