// 自學・墨池：記憶配對牌／閃卡／連連看。一個 overlay，選單進各遊戲。
// 遊戲邏輯純函式在 ./selfstudy/*.js 與 ./leitner.js；本檔只管 DOM 與互動。
// 記憶牌與連連看用「字↔注音」配對（僅字音字形庫）；閃卡用混合庫走 Leitner。

import { saveMeta } from './meta/store.js';
import { samplePairs } from './selfstudy/pairs.js';
import { buildLayout, canConnect, tilesMatch, countRemaining, hasMoves } from './selfstudy/link.js';
import { recordAnswer, nextQuestionId } from './leitner.js';
import { shuffle } from './shuffle.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const $ = (id) => document.getElementById(id);
function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}

let deps = {};        // { loadBank, ensureCtx }
let timers = [];      // 待清理的 setTimeout
let currentRestart = null;

const GAMES = [
  { id: 'memory', name: '記憶配對牌', icon: '🂠', desc: '4×4 翻牌，把國字配到正確注音' },
  { id: 'flash',  name: '閃卡復習',   icon: '📇', desc: '翻卡自評，記得的隔更久再出現' },
  { id: 'link',   name: '連連看',     icon: '🀄', desc: '牽線消除字與注音，路徑轉折 ≤2' },
];

export function initSelfStudy(opts) {
  deps = opts;
  $('btn-selfstudy').addEventListener('click', open);
  $('ss-close').addEventListener('click', close);
  $('ss-back').addEventListener('click', showMenu);
  $('ss-restart').addEventListener('click', () => { if (currentRestart) currentRestart(); });
}

function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }

function open() { showMenu(); openOverlay($('selfstudy-overlay'), close); }
function close() { clearTimers(); closeOverlay($('selfstudy-overlay')); }

function showMenu() {
  clearTimers();
  currentRestart = null;
  $('ss-game').hidden = true;
  $('ss-menu').hidden = false;
  const menu = $('ss-menu');
  menu.innerHTML = '';
  for (const g of GAMES) {
    const card = el('button', 'ss-menu-card');
    card.type = 'button';
    card.innerHTML =
      `<span class="ss-menu-card__icon">${g.icon}</span>` +
      `<span class="ss-menu-card__name">${g.name}</span>` +
      `<span class="ss-menu-card__desc">${g.desc}</span>`;
    card.addEventListener('click', () => enterGame(g.id));
    menu.appendChild(card);
  }
}

function enterGame(id) {
  clearTimers();
  $('ss-menu').hidden = true;
  $('ss-game').hidden = false;
  $('ss-board').className = `ss-board ss-board--${id}`;
  $('ss-board').innerHTML = '';
  $('ss-foot').innerHTML = '';
  $('ss-status').textContent = '載入中…';
  if (id === 'memory') startMemory();
  else if (id === 'link') startLink();
  else if (id === 'flash') startFlash();
}

function setStatus(t) { $('ss-status').textContent = t; }
function setFoot(node) { const f = $('ss-foot'); f.innerHTML = ''; if (node) f.appendChild(node); }

/* ============ 記憶配對牌 ============ */
async function startMemory() {
  currentRestart = startMemory;
  let bank;
  try { bank = await deps.loadBank('ziyin'); } catch { setStatus('題庫載入失敗'); return; }
  const pairs = samplePairs(bank, 8);
  if (pairs.length < 2) { setStatus('可用配對不足'); return; }
  let cards = [];
  pairs.forEach((p, i) => {
    cards.push({ pk: i, label: p.char });
    cards.push({ pk: i, label: p.zhuyin });
  });
  cards = shuffle(cards);

  const board = $('ss-board');
  board.innerHTML = '';
  let first = null, lock = false, moves = 0, matched = 0;
  const total = pairs.length;

  cards.forEach((c, idx) => {
    const btn = el('button', 'mem-card');
    btn.type = 'button';
    btn.dataset.idx = String(idx);
    btn.innerHTML = `<span class="mem-card__back">珠</span><span class="mem-card__face">${c.label}</span>`;
    btn.addEventListener('click', () => flip(idx, btn));
    board.appendChild(btn);
  });
  updateStatus();

  function updateStatus() { setStatus(`配對 ${matched}/${total}・翻牌 ${moves} 次`); }

  function flip(idx, btn) {
    if (lock || btn.classList.contains('is-flipped') || btn.classList.contains('is-matched')) return;
    btn.classList.add('is-flipped');
    if (first === null) { first = { idx, btn }; return; }
    if (first.idx === idx) return;
    moves += 1;
    const a = cards[first.idx], b = cards[idx];
    if (a.pk === b.pk) {
      first.btn.classList.add('is-matched');
      btn.classList.add('is-matched');
      matched += 1;
      first = null;
      updateStatus();
      if (matched === total) win();
    } else {
      lock = true;
      updateStatus();
      const fb = first.btn;
      later(() => {
        fb.classList.remove('is-flipped');
        btn.classList.remove('is-flipped');
        first = null; lock = false;
      }, 750);
    }
  }

  function win() {
    const done = el('div', 'ss-win');
    done.innerHTML = `<b>全部配對完成！</b><span>翻牌 ${moves} 次</span>`;
    const again = el('button', 'ss-again', '再來一局');
    again.type = 'button';
    again.addEventListener('click', startMemory);
    done.appendChild(again);
    setFoot(done);
  }
}

/* ============ 連連看 ============ */
function solvableLayout(pairs, rows, cols) {
  for (let t = 0; t < 40; t++) {
    const g = buildLayout(pairs, rows, cols);
    if (hasMoves(g)) return g;
  }
  return buildLayout(pairs, rows, cols);
}

async function startLink() {
  currentRestart = startLink;
  const ROWS = 4, COLS = 4;
  let bank;
  try { bank = await deps.loadBank('ziyin'); } catch { setStatus('題庫載入失敗'); return; }
  const pairs = samplePairs(bank, (ROWS * COLS) / 2);
  if (pairs.length < (ROWS * COLS) / 2) { setStatus('可用配對不足'); return; }
  let grid = solvableLayout(pairs, ROWS, COLS);
  let sel = null;

  const board = $('ss-board');
  board.style.setProperty('--link-cols', String(COLS));
  render();

  function render() {
    board.innerHTML = '';
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = grid[r][c];
        const cell = el('button', 'link-tile');
        cell.type = 'button';
        if (!t) { cell.classList.add('is-empty'); cell.disabled = true; }
        else {
          cell.textContent = t.label;
          cell.classList.toggle('is-zhuyin', t.kind === 'zhuyin');
          if (sel && sel[0] === r && sel[1] === c) cell.classList.add('is-sel');
          cell.addEventListener('click', () => pick(r, c));
        }
        board.appendChild(cell);
      }
    }
    setStatus(`剩 ${countRemaining(grid)} 張`);
  }

  function pick(r, c) {
    if (!grid[r][c]) return;
    if (!sel) { sel = [r, c]; render(); return; }
    if (sel[0] === r && sel[1] === c) { sel = null; render(); return; }
    const A = grid[sel[0]][sel[1]], B = grid[r][c];
    if (tilesMatch(A, B) && canConnect(grid, sel, [r, c])) {
      grid[sel[0]][sel[1]] = null;
      grid[r][c] = null;
      sel = null;
      if (countRemaining(grid) === 0) { render(); win(); return; }
      if (!hasMoves(grid)) reshuffle();
      render();
    } else {
      sel = [r, c]; // 換選新牌，比較不惱人
      render();
    }
  }

  function reshuffle() {
    let remain = [];
    for (const row of grid) for (const t of row) if (t) remain.push(t);
    for (let tries = 0; tries < 40; tries++) {
      remain = shuffle(remain);
      let k = 0;
      const g = grid.map((row) => row.map((t) => (t ? remain[k++] : null)));
      if (hasMoves(g)) { grid = g; return; }
    }
  }

  function win() {
    const done = el('div', 'ss-win');
    done.innerHTML = '<b>清盤成功！</b>';
    const again = el('button', 'ss-again', '再來一局');
    again.type = 'button';
    again.addEventListener('click', startLink);
    done.appendChild(again);
    setFoot(done);
  }
}

/* ============ 閃卡復習（Leitner，持久化） ============ */
async function startFlash() {
  currentRestart = startFlash;
  let bank, ctx;
  try { bank = await deps.loadBank('mixed'); ctx = await deps.ensureCtx(); } catch { setStatus('題庫載入失敗'); return; }
  if (!ctx || !bank.length) { setStatus('題庫載入失敗'); return; }
  const meta = ctx.meta;
  const boxes = meta.selfstudy.flash;
  const ids = bank.map((e) => e.id);
  const state = new Map(ids.map((id) => [id, boxes[id] ?? 1]));
  const byId = new Map(bank.map((e) => [e.id, e]));
  let reviewed = 0, lastId = null, flipped = false, cur = null;

  next();

  function next() {
    const pool = ids.length > 1 ? ids.filter((x) => x !== lastId) : ids;
    cur = byId.get(nextQuestionId(state, pool));
    flipped = false;
    render();
  }

  function render() {
    const board = $('ss-board');
    board.innerHTML = '';
    setStatus(`已複習 ${reviewed} 張`);
    const card = el('button', `flash-card${flipped ? ' is-flipped' : ''}`);
    card.type = 'button';
    if (!flipped) {
      card.innerHTML = `<span class="flash-card__tag">題目</span><span class="flash-card__q">${cur.question}</span><span class="flash-card__hint">點卡看答案</span>`;
      card.addEventListener('click', () => { flipped = true; render(); });
    } else {
      const note = cur.note ? `<span class="flash-card__note">${cur.note}</span>` : '';
      card.innerHTML = `<span class="flash-card__tag flash-card__tag--a">答案</span><span class="flash-card__a">${cur.answer}</span>${note}`;
      card.addEventListener('click', () => { flipped = false; render(); });
    }
    board.appendChild(card);

    const foot = el('div', 'flash-rate');
    if (flipped) {
      const forgot = el('button', 'flash-rate__btn flash-rate__btn--no', '忘了');
      forgot.type = 'button';
      forgot.addEventListener('click', () => rate(false));
      const got = el('button', 'flash-rate__btn flash-rate__btn--yes', '記得');
      got.type = 'button';
      got.addEventListener('click', () => rate(true));
      foot.append(forgot, got);
    } else {
      foot.appendChild(el('span', 'flash-rate__hint', '先想答案，再翻卡自評'));
    }
    setFoot(foot);
  }

  function rate(remember) {
    recordAnswer(state, cur.id, remember);
    boxes[cur.id] = state.get(cur.id);
    saveMeta(meta);
    reviewed += 1;
    lastId = cur.id;
    next();
  }
}
