// 翰墨集市：前端瀏覽 UI（本檔只做「看」——上架／買下留給後續 Task）。
// 掛單卡珠面複用字珠寶殿的 pearl-chip 配色（凡品→白珠 g0／良品→青珠 g1／珍品→金珠 g2）。
import { ZZAPI } from './meta/api.js';
import { GEAR_LIST } from './meta/gear.js';
import { tierOf, TIER_LABEL, isMarketOpen, nextOpenText } from './market-store.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

// 掛單「稀有度」→ pearl-chip 品階數字。集市裝備的稀有度（凡/良/珍）跟字珠品階（白/青/金/墨玉）
// 是兩套獨立分級，這裡只借用視覺配色，凡品配白珠、良品配青珠、珍品配金珠，不套用 market-store.js
// 的 TIER_GRADE（那組字母是給後端簽章/展示用的階級標籤，非 CSS 品階編號，兩者別混用）。
const TIER_TO_PEARL_G = { fan: 0, liang: 1, zhen: 2 };

const $ = (id) => document.getElementById(id);

let getMeta = () => null;
let saveMeta = () => {};
let scope = 'class'; // 'class' | 'pub'

async function callMarket(body) {
  try {
    return await ZZAPI.call('/api/market', { body });
  } catch {
    return null;
  }
}

export function initMarketUI(opts) {
  getMeta = opts.getMeta;
  saveMeta = opts.saveMeta || saveMeta;
  $('btn-market').addEventListener('click', open);
  $('market-close').addEventListener('click', close);
  $('mkt-tab-class').addEventListener('click', () => switchTab('class'));
  $('mkt-tab-pub').addEventListener('click', () => switchTab('pub'));
}

async function open() {
  if (!getMeta()) return;
  scope = 'class';
  updateTabs();
  await render();
  openOverlay($('market-overlay'), close);
}

function close() { closeOverlay($('market-overlay')); }

function updateTabs() {
  $('mkt-tab-class').classList.toggle('is-active', scope === 'class');
  $('mkt-tab-pub').classList.toggle('is-active', scope === 'pub');
}

async function switchTab(next) {
  if (scope === next) return;
  scope = next;
  updateTabs();
  await render();
}

function renderStatus(meta) {
  const open = isMarketOpen();
  const status = $('mkt-status');
  status.innerHTML = '';

  const badge = document.createElement('span');
  badge.className = open ? 'mkt-badge mkt-open' : 'mkt-badge mkt-closed';
  badge.textContent = open ? '開市中🔥' : `平日／${nextOpenText()}`;
  status.appendChild(badge);

  if (!open) {
    const hint = document.createElement('span');
    hint.className = 'mkt-status__hint';
    hint.textContent = '今日僅供瀏覽';
    status.appendChild(hint);
  }

  const balance = document.createElement('span');
  balance.className = 'mkt-status__balance';
  balance.textContent = `字珠餘額 ${meta.pearls.balance}`;
  status.appendChild(balance);
}

// list API（見 functions/api/market.js memberOf）只回精簡欄位
// { id, gearId, seller, price, ts, reserved: 0|1, pub: 0|1 }，裝備名／稀有度要前端自己查表；
// 保留單也只給 0/1 旗標（不洩漏保留對象暱稱給非本人）。
function renderCard(item) {
  const gear = GEAR_LIST.find((g) => g.id === item.gearId);
  const tier = tierOf(item.gearId);

  const card = document.createElement('div');
  card.className = `mkt-card${item.reserved ? ' mkt-card--reserved' : ''}`;

  const chip = document.createElement('span');
  const g = TIER_TO_PEARL_G[tier] ?? 0;
  chip.className = `pearl-chip pearl-chip--g${g}`;
  chip.textContent = gear ? gear.name : item.gearId; // 找不到裝備名時兜底顯示原始 id

  const meta = document.createElement('div');
  meta.className = 'mkt-card__meta';

  const line1 = document.createElement('div');
  line1.className = 'mkt-card__line1';
  const tierSpan = document.createElement('span');
  tierSpan.className = 'mkt-card__tier';
  tierSpan.textContent = TIER_LABEL[tier] || '';
  const sellerSpan = document.createElement('span');
  sellerSpan.className = 'mkt-card__seller';
  sellerSpan.textContent = item.seller ? `賣家：${item.seller}` : '';
  line1.appendChild(tierSpan);
  line1.appendChild(sellerSpan);

  const line2 = document.createElement('div');
  line2.className = 'mkt-card__line2';
  if (item.reserved) {
    const lock = document.createElement('span');
    lock.className = 'mkt-card__lock';
    lock.textContent = '🔒 保留單';
    line2.appendChild(lock);
  }
  const price = document.createElement('span');
  price.className = 'mkt-card__price';
  price.textContent = `${item.price} 字珠`;
  line2.appendChild(price);

  meta.appendChild(line1);
  meta.appendChild(line2);
  card.appendChild(chip);
  card.appendChild(meta);
  return card;
}

async function render() {
  const meta = getMeta();
  renderStatus(meta);

  const list = $('mkt-list');
  const empty = $('mkt-empty');
  list.innerHTML = '';
  empty.hidden = true;

  const classCode = meta.selfstudy.classCode;
  if (scope === 'class' && !classCode) {
    empty.hidden = false;
    empty.textContent = '先到積分競技設定班級代碼與暱稱，才能進集市';
    return;
  }

  const body = scope === 'pub'
    ? { op: 'list', scope: 'pub' }
    : { op: 'list', classCode, scope: 'class' };
  const res = await callMarket(body);

  if (!res) {
    empty.hidden = false;
    empty.textContent = '📡 連不上集市伺服器';
    return;
  }
  if (!res.ok) {
    empty.hidden = false;
    empty.textContent = res.error ? String(res.error) : '📡 連不上集市伺服器';
    return;
  }

  const items = res.list || [];
  if (items.length === 0) {
    empty.hidden = false;
    empty.textContent = '集市還空著，週末再來看看有沒有人上架吧！';
    return;
  }
  for (const item of items) list.appendChild(renderCard(item));
}
