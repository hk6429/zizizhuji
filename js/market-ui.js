// 翰墨集市：前端 UI——瀏覽／上架／購買／我的掛單四條流程全在這裡接線。
// 掛單卡珠面複用字珠寶殿的 pearl-chip 配色（凡品→白珠 g0／良品→青珠 g1／珍品→金珠 g2）。
// 金流與資產一律只透過 market-store.js 的函式異動 meta，異動後立即 saveMeta；
// 站內 toast()（js/integration.js）是私有函式未 export，本檔一律降級用 #mkt-msg 行內訊息。
import { ZZAPI } from './meta/api.js';
import { GEAR_LIST } from './meta/gear.js';
import { getToday } from './integration.js';
import {
  tierOf, TIER_LABEL, isMarketOpen, nextOpenText, bandOf, sellableGear,
  removeGear, grantGear, payForBuy, buysToday, bumpBuys, addClaim, removeClaim,
  getClaims, recordEverOwned, getEverOwned, settleSale, THANKS_CARDS, DAILY_BUY_CAP,
} from './market-store.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const CLOSED_HINT = '⏳ 今日僅供瀏覽——週五 16:00 開市';

// 掛單「稀有度」→ pearl-chip 品階數字。集市裝備的稀有度（凡/良/珍）跟字珠品階（白/青/金/墨玉）
// 是兩套獨立分級，這裡只借用視覺配色，凡品配白珠、良品配青珠、珍品配金珠，不套用 market-store.js
// 的 TIER_GRADE（那組字母是給後端簽章/展示用的階級標籤，非 CSS 品階編號，兩者別混用）。
const TIER_TO_PEARL_G = { fan: 0, liang: 1, zhen: 2 };

const $ = (id) => document.getElementById(id);

let getMeta = () => null;
let saveMeta = () => {};
let scope = 'class'; // 'class' | 'pub' | 'stars' | 'ever'
let selectedSellGear = null; // 上架流程：目前選定要賣的裝備 { id, name, price, tier, tierLabel, grade }
let pendingBuy = null; // 購買流程：等待挑感謝小卡的掛單 { id, gearId, price, seller }
let claimState = {}; // 我的掛單：{ [claimId]: 'unsold' }，檢查後發現未售出時記住，讓下架鈕出現

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
  ensureExtraDom();
  $('btn-market').addEventListener('click', open);
  $('market-close').addEventListener('click', close);
  $('mkt-tab-class').addEventListener('click', () => switchTab('class'));
  $('mkt-tab-pub').addEventListener('click', () => switchTab('pub'));
  $('mkt-tab-stars').addEventListener('click', () => switchTab('stars'));
  $('mkt-tab-ever').addEventListener('click', () => switchTab('ever'));
}

// 上架區／我的掛單區／感謝小卡對話框：index.html 本來沒有這些節點，動態建立一次即可（冪等）。
function ensureExtraDom() {
  if ($('mkt-sell')) return;
  const wrap = document.querySelector('#market-overlay .mkt-card-wrap');
  const closeBtn = $('market-close');

  const msg = document.createElement('p');
  msg.id = 'mkt-msg';
  msg.className = 'mkt-msg';
  msg.hidden = true;
  $('mkt-status').insertAdjacentElement('afterend', msg);

  const sell = document.createElement('div');
  sell.id = 'mkt-sell';
  sell.className = 'mkt-sell';
  sell.innerHTML = `
    <h3 class="mkt-sell__title">📤 我要上架</h3>
    <p id="mkt-sell-closed-hint" class="mkt-sell__closed-hint" hidden></p>
    <div id="mkt-sell-body">
      <div id="mkt-sell-gear-list" class="mkt-sell-gear-list"></div>
      <div id="mkt-sell-form" class="mkt-sell-form" hidden>
        <p id="mkt-sell-band" class="mkt-sell-band"></p>
        <label class="mkt-sell-field">定價
          <input id="mkt-sell-price" type="number" step="1">
        </label>
        <label id="mkt-sell-reserve-wrap" class="mkt-sell-field">保留給同班同學
          <select id="mkt-sell-reserve">
            <option value="">不保留（公開搶購）</option>
          </select>
        </label>
        <label class="mkt-sell-field mkt-sell-field--checkbox">
          <input id="mkt-sell-pub" type="checkbox">
          公開到全站集市
        </label>
        <button id="mkt-sell-confirm" class="mkt-sell-confirm" type="button">確認上架</button>
      </div>
    </div>`;

  const mine = document.createElement('div');
  mine.id = 'mkt-mine';
  mine.className = 'mkt-mine';
  mine.innerHTML = `
    <h3 class="mkt-mine__title">📋 我的掛單</h3>
    <div id="mkt-mine-list" class="mkt-mine-list"></div>`;

  closeBtn.insertAdjacentElement('beforebegin', sell);
  closeBtn.insertAdjacentElement('beforebegin', mine);

  const thanks = document.createElement('div');
  thanks.id = 'mkt-thanks-dialog';
  thanks.className = 'mkt-thanks-dialog';
  thanks.hidden = true;
  thanks.innerHTML = `
    <p class="mkt-thanks-dialog__title">要附上一張感謝小卡嗎？</p>
    <div id="mkt-thanks-cards" class="mkt-thanks-cards"></div>
    <button id="mkt-thanks-none" class="mkt-thanks-none" type="button">不送，直接購買</button>
    <button id="mkt-thanks-cancel" class="mkt-thanks-cancel" type="button">取消</button>`;
  wrap.appendChild(thanks);

  THANKS_CARDS.forEach((text, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mkt-thanks-card';
    btn.textContent = text;
    btn.addEventListener('click', () => finalizeBuy(i + 1));
    $('mkt-thanks-cards').appendChild(btn);
  });
  $('mkt-thanks-none').addEventListener('click', () => finalizeBuy(0));
  $('mkt-thanks-cancel').addEventListener('click', () => {
    pendingBuy = null;
    $('mkt-thanks-dialog').hidden = true;
  });

  $('mkt-sell-confirm').addEventListener('click', confirmSell);
}

function showMsg(text, ok = true) {
  const el = $('mkt-msg');
  el.hidden = false;
  el.textContent = text;
  el.className = `mkt-msg ${ok ? 'mkt-msg--ok' : 'mkt-msg--err'}`;
}

function clearMsg() {
  const el = $('mkt-msg');
  el.hidden = true;
  el.textContent = '';
}

async function open() {
  if (!getMeta()) return;
  scope = 'class';
  selectedSellGear = null;
  claimState = {};
  clearMsg();
  updateTabs();
  await render();
  openOverlay($('market-overlay'), close);
}

function close() { closeOverlay($('market-overlay')); }

function updateTabs() {
  $('mkt-tab-class').classList.toggle('is-active', scope === 'class');
  $('mkt-tab-pub').classList.toggle('is-active', scope === 'pub');
  $('mkt-tab-stars').classList.toggle('is-active', scope === 'stars');
  $('mkt-tab-ever').classList.toggle('is-active', scope === 'ever');
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
function renderCard(meta, item) {
  const gear = GEAR_LIST.find((g) => g.id === item.gearId);
  const tier = tierOf(item.gearId);

  const card = document.createElement('div');
  card.className = `mkt-card${item.reserved ? ' mkt-card--reserved' : ''}`;

  const chip = document.createElement('span');
  const g = TIER_TO_PEARL_G[tier] ?? 0;
  chip.className = `pearl-chip pearl-chip--g${g}`;
  chip.textContent = gear ? gear.name : item.gearId; // 找不到裝備名時兜底顯示原始 id

  const metaBox = document.createElement('div');
  metaBox.className = 'mkt-card__meta';

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

  metaBox.appendChild(line1);
  metaBox.appendChild(line2);
  card.appendChild(chip);
  card.appendChild(metaBox);

  if (isMarketOpen()) {
    const buyBtn = document.createElement('button');
    buyBtn.type = 'button';
    buyBtn.className = 'mkt-card__buy';
    buyBtn.textContent = '購買';
    buyBtn.addEventListener('click', () => startBuy(meta, item));
    card.appendChild(buyBtn);
  } else {
    const closedNote = document.createElement('span');
    closedNote.className = 'mkt-card__closed-note';
    closedNote.textContent = CLOSED_HINT;
    card.appendChild(closedNote);
  }
  return card;
}

async function render() {
  const meta = getMeta();
  renderStatus(meta);
  renderSell(meta);
  renderMine(meta);

  const list = $('mkt-list');
  const empty = $('mkt-empty');
  const starsBox = $('mkt-stars');
  const everBox = $('mkt-ever');
  list.innerHTML = '';
  empty.hidden = true;
  starsBox.hidden = true;
  everBox.hidden = true;
  list.hidden = false;

  if (scope === 'ever') {
    list.hidden = true;
    everBox.hidden = false;
    renderEver(everBox);
    return;
  }
  if (scope === 'stars') {
    list.hidden = true;
    starsBox.hidden = false;
    await renderStars(meta, starsBox);
    return;
  }

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
  for (const item of items) list.appendChild(renderCard(meta, item));
}

/* ---------------- 🏆 本班集市達人：前 10 名成交量排行（只列筆數不列金額）---------------- */

async function renderStars(meta, box) {
  box.innerHTML = '';
  const classCode = meta.selfstudy.classCode;
  if (!classCode) {
    const p = document.createElement('p');
    p.className = 'mkt-empty';
    p.textContent = '先到積分競技設定班級代碼與暱稱，才能看集市達人榜';
    box.appendChild(p);
    return;
  }
  const res = await callMarket({ op: 'stars', classCode });
  const top = res && res.ok ? (res.top || []) : [];
  if (top.length === 0) {
    const p = document.createElement('p');
    p.className = 'mkt-empty';
    p.textContent = '本週還沒有人成交——當第一個吧！';
    box.appendChild(p);
    return;
  }
  const ol = document.createElement('ol');
  ol.className = 'mkt-stars-list';
  top.slice(0, 10).forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'mkt-stars-row';

    const rank = document.createElement('span');
    rank.className = 'mkt-stars-row__rank';
    rank.textContent = String(i + 1);

    const name = document.createElement('span');
    name.className = 'mkt-stars-row__name';
    name.textContent = s.name;

    const deals = document.createElement('span');
    deals.className = 'mkt-stars-row__deals';
    deals.textContent = `成交 ${s.deals} 筆`;

    li.appendChild(rank);
    li.appendChild(name);
    li.appendChild(deals);

    if (i === 0) {
      const badge = document.createElement('span');
      badge.className = 'mkt-stars-row__badge';
      badge.textContent = '🏆 本班集市達人';
      li.appendChild(badge);
    }
    ol.appendChild(li);
  });
  box.appendChild(ol);
}

/* ---------------- 📜 曾經持有：時間倒序收藏冊，賣掉的寶物留痕 ---------------- */

function renderEver(box) {
  box.innerHTML = '';
  const entries = getEverOwned();
  if (entries.length === 0) {
    const p = document.createElement('p');
    p.className = 'mkt-empty';
    p.textContent = '還沒有交易紀錄，去集市逛逛吧';
    box.appendChild(p);
    return;
  }
  for (const entry of entries) {
    const gear = GEAR_LIST.find((g) => g.id === entry.gearId);
    const card = document.createElement('div');
    card.className = 'mkt-ever-card';

    const name = document.createElement('span');
    name.className = 'mkt-ever-card__name';
    name.textContent = gear ? gear.name : entry.gearId;

    const peer = document.createElement('span');
    peer.className = 'mkt-ever-card__peer';
    const verb = entry.dir === 'sold' ? '售予' : '購自';
    peer.textContent = `${verb} ${entry.peer || '匿名同學'}`;

    const date = document.createElement('span');
    date.className = 'mkt-ever-card__date';
    date.textContent = new Date(entry.ts).toLocaleDateString('zh-TW');

    card.appendChild(name);
    card.appendChild(peer);
    card.appendChild(date);
    box.appendChild(card);
  }
}

/* ---------------- 上架：📤 我要上架 ---------------- */

function renderSell(meta) {
  const open = isMarketOpen();
  const hint = $('mkt-sell-closed-hint');
  hint.hidden = open;
  hint.textContent = CLOSED_HINT;
  $('mkt-sell-body').hidden = !open;
  if (!open) return;

  const list = $('mkt-sell-gear-list');
  list.innerHTML = '';
  const gears = sellableGear(meta);
  for (const g of gears) {
    const chip = document.createElement('button');
    chip.type = 'button';
    const gradeG = TIER_TO_PEARL_G[g.tier] ?? 0;
    chip.className = `pearl-chip pearl-chip--g${gradeG} mkt-sell-gear-btn${selectedSellGear && selectedSellGear.id === g.id ? ' is-selected' : ''}`;
    chip.textContent = g.name;
    chip.addEventListener('click', () => selectSellGear(meta, g));
    list.appendChild(chip);
  }
  if (!gears.some((g) => selectedSellGear && g.id === selectedSellGear.id)) {
    selectedSellGear = null;
    $('mkt-sell-form').hidden = true;
  }
}

async function selectSellGear(meta, gear) {
  selectedSellGear = gear;
  renderSell(meta); // 更新選中樣式

  const [lo, hi] = bandOf(gear.id) || [gear.price, gear.price];
  $('mkt-sell-band').textContent = `${gear.tierLabel}定價帶：${lo}–${hi} 字珠`;
  const priceInput = $('mkt-sell-price');
  priceInput.min = lo;
  priceInput.max = hi;
  priceInput.value = lo;

  const reserveSelect = $('mkt-sell-reserve');
  reserveSelect.innerHTML = '<option value="">不保留（公開搶購）</option>';
  const reserveWrap = $('mkt-sell-reserve-wrap');
  reserveWrap.hidden = true;
  if (meta.selfstudy.classCode) {
    const res = await callMarket({ op: 'stars', classCode: meta.selfstudy.classCode });
    const top = res && res.ok ? (res.top || []) : [];
    if (top.length > 0) {
      for (const s of top) {
        if (s.name === meta.selfstudy.nick) continue; // 不能保留給自己
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.name;
        reserveSelect.appendChild(opt);
      }
      reserveWrap.hidden = false;
    }
  }

  $('mkt-sell-pub').checked = false;
  $('mkt-sell-form').hidden = false;
}

async function confirmSell() {
  const meta = getMeta();
  if (!selectedSellGear) return;
  if (!meta.selfstudy.nick || !meta.selfstudy.classCode) {
    showMsg('請先到積分競技設定班級代碼與暱稱', false);
    return;
  }
  const price = Math.round(Number($('mkt-sell-price').value) || 0);
  const reserveFor = $('mkt-sell-reserve').value || '';
  const pub = $('mkt-sell-pub').checked;
  const gearId = selectedSellGear.id;

  const res = await callMarket({
    op: 'post', gearId, price, seller: meta.selfstudy.nick, classCode: meta.selfstudy.classCode, pub, reserveFor,
  });
  if (!res || !res.ok) {
    showMsg(res && res.error ? res.error : '📡 連不上集市伺服器，稍後再試', false);
    return;
  }

  removeGear(meta, gearId);
  addClaim({
    id: res.id, claimKey: res.claimKey, gearId, price,
    classCode: meta.selfstudy.classCode, seller: meta.selfstudy.nick, ts: Date.now(),
  });
  saveMeta(meta);
  selectedSellGear = null;
  showMsg('已上架！賣出後回來領貨款', true);
  await render();
}

/* ---------------- 購買：掛單卡「購買」鈕 ---------------- */

function startBuy(meta, item) {
  if (!meta.selfstudy.nick || !meta.selfstudy.classCode) {
    showMsg('請先到積分競技設定班級代碼與暱稱', false);
    return;
  }
  if (buysToday() >= DAILY_BUY_CAP) {
    showMsg(`每日限購 ${DAILY_BUY_CAP} 件，明天再來喔`, false);
    return;
  }
  if (meta.pearls.balance < item.price) {
    showMsg('字珠不夠，再多練幾場攢一點吧', false);
    return;
  }
  if ((meta.gear.owned || []).includes(item.gearId)) {
    showMsg('你已擁有這件，讓給別人吧', false);
    return;
  }
  pendingBuy = { id: item.id, gearId: item.gearId, price: item.price, seller: item.seller };
  $('mkt-thanks-dialog').hidden = false;
}

async function finalizeBuy(cardId) {
  const meta = getMeta();
  const item = pendingBuy;
  $('mkt-thanks-dialog').hidden = true;
  pendingBuy = null;
  if (!item) return;

  const res = await callMarket({
    op: 'buy', id: item.id, nick: meta.selfstudy.nick, classCode: meta.selfstudy.classCode, cardId,
  });
  if (!res || !res.ok) {
    showMsg(res && res.error ? res.error : '📡 連不上集市伺服器，稍後再試', false);
    return;
  }

  const pay = payForBuy(meta, res.price);
  if (!pay.ok) {
    showMsg('字珠餘額異動失敗，請重新整理再試', false);
    return;
  }
  grantGear(meta, res.gearId);
  bumpBuys();
  recordEverOwned({ dir: 'bought', peer: item.seller, gearId: res.gearId, price: res.price, ts: Date.now() });
  saveMeta(meta);

  const gearName = (GEAR_LIST.find((g) => g.id === res.gearId) || {}).name || res.gearId;
  showMsg(`購買成功！「${gearName}」已入袋`, true);
  await render();
}

/* ---------------- 我的掛單：檢查／領款／下架 ---------------- */

function renderMine(meta) {
  const list = $('mkt-mine-list');
  list.innerHTML = '';
  const claims = getClaims();
  if (claims.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'mkt-mine-empty';
    empty.textContent = '目前沒有掛單中的寶物';
    list.appendChild(empty);
    return;
  }
  for (const claim of claims) list.appendChild(renderMineRow(meta, claim));
}

function renderMineRow(meta, claim) {
  const gear = GEAR_LIST.find((g) => g.id === claim.gearId);
  const row = document.createElement('div');
  row.className = 'mkt-mine-row';

  const label = document.createElement('span');
  label.className = 'mkt-mine-row__label';
  label.textContent = `${gear ? gear.name : claim.gearId}・${claim.price} 字珠`;
  row.appendChild(label);

  const state = claimState[claim.id];
  if (state === 'unsold') {
    const note = document.createElement('span');
    note.className = 'mkt-mine-row__note';
    note.textContent = '尚未售出';
    row.appendChild(note);

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'mkt-mine-row__cancel';
    cancelBtn.textContent = '下架拿回';
    cancelBtn.addEventListener('click', () => cancelListing(meta, claim));
    row.appendChild(cancelBtn);
  } else {
    const checkBtn = document.createElement('button');
    checkBtn.type = 'button';
    checkBtn.className = 'mkt-mine-row__check';
    checkBtn.textContent = '檢查';
    checkBtn.addEventListener('click', () => checkClaim(meta, claim));
    row.appendChild(checkBtn);
  }
  return row;
}

async function checkClaim(meta, claim) {
  const res = await callMarket({ op: 'claim', id: claim.id, claimKey: claim.claimKey });
  if (!res) {
    showMsg('📡 連不上集市伺服器', false);
    return;
  }
  if (res.ok) {
    settleSale(meta, res.pearls, getToday());
    removeClaim(claim.id);
    recordEverOwned({ dir: 'sold', peer: res.buyer || '', gearId: claim.gearId, price: claim.price, ts: Date.now() });
    saveMeta(meta);
    delete claimState[claim.id];
    const card = res.card > 0 ? THANKS_CARDS[res.card - 1] : '';
    showMsg(card ? `已售出！買家留言：「${card}」・入帳 ${res.pearls} 字珠` : `已售出！入帳 ${res.pearls} 字珠`, true);
    await render();
    return;
  }
  if (res.sold === 0) {
    claimState[claim.id] = 'unsold';
    renderMine(meta);
    return;
  }
  // 找不到掛單／貨款已領過：本機紀錄已經跟不上伺服器狀態，自癒清掉（比照 vocab-duel 手法）
  removeClaim(claim.id);
  delete claimState[claim.id];
  showMsg('這筆掛單已處理過，本機紀錄已清除', false);
  renderMine(meta);
}

async function cancelListing(meta, claim) {
  const res = await callMarket({ op: 'cancel', id: claim.id, claimKey: claim.claimKey });
  if (!res) {
    showMsg('📡 連不上集市伺服器', false);
    return;
  }
  if (res.ok) {
    grantGear(meta, res.gearId);
    removeClaim(claim.id);
    saveMeta(meta);
    delete claimState[claim.id];
    showMsg('已下架，寶物已拿回', true);
    await render();
    return;
  }
  if (res.error === '找不到掛單') {
    removeClaim(claim.id);
    delete claimState[claim.id];
    showMsg('這筆掛單已處理過，本機紀錄已清除', false);
    renderMine(meta);
    return;
  }
  showMsg(res.error || '下架失敗', false);
}
