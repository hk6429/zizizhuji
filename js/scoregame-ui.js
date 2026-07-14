// 積分競技（M2）：獨自衝分／對電腦／兩人對戰，共用 scoreEngine。
// 升級(base)×加倍(combo)×逐步升等×保險，規則全在 ./scoreEngine.js；本檔管 DOM。
// 題目用混合庫；字珠錢包（保險）走 meta/economy，存檔經 store.saveMeta。

import { saveMeta } from './meta/store.js';
import { spendPearls, getBalance } from './meta/economy.js';
import {
  createScoreState, answer, promote, canPromote, comboMultiplier,
  buyInsurance, TIERS, INSURANCE_COST,
} from './scoreEngine.js';

const $ = (id) => document.getElementById(id);
function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

const ROUNDS = 10;        // 對電腦／兩人：每位真人各答 10 題
const CPU_ACC = 0.6;      // 電腦答對率
const TURN_DELAY = 700;
const AI_DELAY = 950;
const BEST_KEY = 'mixed';

const MODES = [
  { id: 'solo',    name: '獨自衝分', icon: '🎯', desc: '一路答下去衝高分，答錯會扣分，隨時結束' },
  { id: 'vscpu',   name: '對電腦',   icon: '🤖', desc: `跟墨靈電腦各答 ${ROUNDS} 題，比總分` },
  { id: 'hotseat', name: '兩人對戰', icon: '🆚', desc: `同一台輪流作答，各 ${ROUNDS} 題定勝負` },
];

let deps = {};
let timers = [];
let state = null;

export function initScoreGame(opts) {
  deps = opts; // { loadBank, ensureCtx, onChange }
  $('btn-scoregame').addEventListener('click', open);
  $('sg-close').addEventListener('click', close);
  $('sg-quit').addEventListener('click', () => results(true));
}

function clearTimers() { timers.forEach(clearTimeout); timers = []; }
function later(fn, ms) { const t = setTimeout(fn, ms); timers.push(t); return t; }

function open() { showMenu(); $('scoregame-overlay').hidden = false; }
function close() { clearTimers(); state = null; $('scoregame-overlay').hidden = true; }

function showMenu() {
  clearTimers();
  state = null;
  $('sg-play').hidden = true;
  $('sg-menu').hidden = false;
  const menu = $('sg-menu');
  menu.innerHTML = '';
  for (const m of MODES) {
    const card = el('button', 'sg-menu-card');
    card.type = 'button';
    card.innerHTML =
      `<span class="sg-menu-card__icon">${m.icon}</span>` +
      `<span class="sg-menu-card__name">${m.name}</span>` +
      `<span class="sg-menu-card__desc">${m.desc}</span>`;
    card.addEventListener('click', () => startMode(m.id));
    menu.appendChild(card);
  }
}

async function startMode(mode) {
  clearTimers();
  $('sg-menu').hidden = true;
  $('sg-play').hidden = false;
  $('sg-question').textContent = '載入中…';
  $('sg-options').innerHTML = '';
  $('sg-turn').textContent = '';

  let bank, ctx;
  try { bank = await deps.loadBank('mixed'); ctx = await deps.ensureCtx(); }
  catch { $('sg-question').textContent = '題庫載入失敗，收起再試。'; return; }
  if (!ctx || !bank.length) { $('sg-question').textContent = '題庫載入失敗，收起再試。'; return; }

  const players =
    mode === 'solo' ? [{ name: '你', ai: false }]
    : mode === 'vscpu' ? [{ name: '你', ai: false }, { name: '墨靈電腦', ai: true, acc: CPU_ACC }]
    : [{ name: '玩家一', ai: false }, { name: '玩家二', ai: false }];
  players.forEach((p) => { p.score = createScoreState(); p.answered = 0; });

  state = {
    mode, players, turn: 0, meta: ctx.meta,
    queue: shuffle(bank), qi: 0, ROUNDS: mode === 'solo' ? Infinity : ROUNDS,
  };
  $('sg-quit').textContent = mode === 'solo' ? '結束並看成績' : '提前結束';
  step();
}

function nextQuestion() {
  if (state.qi >= state.queue.length) state.queue = shuffle(state.queue), state.qi = 0;
  return state.queue[state.qi++];
}

function versusDone() {
  return state.mode !== 'solo' && state.players.every((p) => p.answered >= state.ROUNDS);
}

function advanceTurn() {
  if (state.mode === 'solo') return;
  for (let i = 1; i <= state.players.length; i++) {
    const idx = (state.turn + i) % state.players.length;
    if (state.players[idx].answered < state.ROUNDS) { state.turn = idx; return; }
  }
}

function step() {
  if (versusDone()) { results(); return; }
  renderHud();
  const p = state.players[state.turn];
  if (p.ai) aiTurn(p); else humanTurn(p);
}

/* ---------- HUD：計分板＋升等／保險 ---------- */
function renderHud() {
  const hud = $('sg-hud');
  hud.innerHTML = '';
  state.players.forEach((p, i) => {
    const board = el('div', `sg-score${i === state.turn ? ' is-active' : ''}`);
    const roundTxt = state.mode === 'solo' ? '' : `<span class="sg-score__round">${Math.min(p.answered, state.ROUNDS)}/${state.ROUNDS}</span>`;
    board.innerHTML =
      `<span class="sg-score__name">${p.name}</span>` +
      `<span class="sg-score__val">${p.score.score}</span>` +
      `<span class="sg-score__tier">${TIERS[p.score.tier].name}${p.score.insured ? '・保' : ''}</span>` +
      roundTxt;
    if (p.score.streak >= 3) {
      board.appendChild(el('span', 'sg-score__combo', `連${p.score.streak} ×${comboMultiplier(p.score.streak)}`));
    }
    hud.appendChild(board);
  });

  // 控制列：只對「當前真人」開放升等／保險
  const ctrl = $('sg-ctrl');
  ctrl.innerHTML = '';
  const p = state.players[state.turn];
  if (!p.ai) {
    const up = el('button', 'sg-ctrl-btn sg-ctrl-btn--up', '升等');
    up.type = 'button';
    up.disabled = !canPromote(p.score);
    up.title = `分數達 ${TIERS[Math.min(p.score.tier + 1, TIERS.length - 1)].at} 可升等`;
    up.addEventListener('click', () => {
      const r = promote(p.score);
      if (r.promoted) { p.score = r.state; floatMsg(`升等「${r.name}」！答對得分翻倍`, 'up'); renderHud(); }
    });
    const ins = el('button', 'sg-ctrl-btn sg-ctrl-btn--ins', p.score.insured ? '已保險' : `保險 ${INSURANCE_COST}珠`);
    ins.type = 'button';
    ins.disabled = p.score.insured || getBalance(state.meta) < INSURANCE_COST;
    ins.addEventListener('click', () => {
      const r = buyInsurance(state.meta, p.score, spendPearls);
      if (r.ok) { p.score = r.state; saveMeta(state.meta); deps.onChange && deps.onChange(); floatMsg('已保險！答錯少扣', 'ins'); renderHud(); }
    });
    ctrl.append(up, ins);
  }
}

function floatMsg(text, kind) {
  const host = $('sg-turn');
  const s = el('span', `sg-float sg-float--${kind || ''}`, text);
  host.appendChild(s);
  later(() => s.remove(), 1200);
}

/* ---------- 電腦回合 ---------- */
function aiTurn(p) {
  $('sg-question').textContent = `${p.name}作答中…`;
  $('sg-options').innerHTML = '';
  later(() => {
    const correct = Math.random() < p.acc;
    const r = answer(p.score, correct);
    p.score = r.state;
    p.answered += 1;
    floatMsg(correct ? `${p.name} ＋${r.gain}` : `${p.name} 答錯 −${r.penalty}`, correct ? 'gain' : 'pen');
    renderHud();
    advanceTurn();
    later(step, TURN_DELAY);
  }, AI_DELAY);
}

/* ---------- 真人回合 ---------- */
function humanTurn(p) {
  const q = nextQuestion();
  const turnLabel = state.mode === 'hotseat' ? `${p.name}，輪到你！` : '';
  $('sg-turn').textContent = turnLabel;
  $('sg-question').textContent = q.question;
  const optionsEl = $('sg-options');
  optionsEl.innerHTML = '';
  for (const opt of q.options) {
    const btn = el('button', 'sg-opt', opt);
    btn.type = 'button';
    btn.dataset.value = opt;
    optionsEl.appendChild(btn);
  }
  optionsEl.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn || btn.disabled) return;
    optionsEl.onclick = null;
    const correct = btn.dataset.value === q.answer;
    for (const b of optionsEl.querySelectorAll('button')) {
      b.disabled = true;
      if (b.dataset.value === q.answer) b.classList.add('is-correct');
      else if (b === btn) b.classList.add('is-wrong');
    }
    const r = answer(p.score, correct);
    p.score = r.state;
    p.answered += 1;
    floatMsg(correct ? `＋${r.gain}${p.score.streak >= 3 ? ` 連${p.score.streak}` : ''}` : `答錯 −${r.penalty}`, correct ? 'gain' : 'pen');
    renderHud();
    advanceTurn();
    later(step, TURN_DELAY + 250);
  };
}

/* ---------- 成績 ---------- */
function results(early) {
  clearTimers();
  const optionsEl = $('sg-options');
  optionsEl.onclick = null;
  optionsEl.innerHTML = '';
  $('sg-turn').textContent = '';

  const humans = state.players.filter((p) => !p.ai);
  const best = humans.reduce((m, p) => Math.max(m, p.score.best), 0);
  const prevBest = state.meta.selfstudy.scoreBest[BEST_KEY] || 0;
  if (best > prevBest) { state.meta.selfstudy.scoreBest[BEST_KEY] = best; saveMeta(state.meta); deps.onChange && deps.onChange(); }

  let title;
  if (state.mode === 'solo') title = early ? '衝分結束' : '衝分結束';
  else {
    const ranked = [...state.players].sort((a, b) => b.score.score - a.score.score);
    title = ranked[0].score.score === ranked[1].score.score ? '平手！' : `${ranked[0].name} 勝！`;
  }
  $('sg-question').textContent = title;

  const panel = el('div', 'sg-result');
  const sorted = [...state.players].sort((a, b) => b.score.score - a.score.score);
  for (const p of sorted) {
    const row = el('div', 'sg-result__row');
    row.innerHTML =
      `<span class="sg-result__name">${p.name}</span>` +
      `<span class="sg-result__score">${p.score.score} 分</span>` +
      `<span class="sg-result__meta">${TIERS[p.score.tier].name}・答對 ${p.score.correct}/${p.score.answered}</span>`;
    panel.appendChild(row);
  }
  const bestLine = el('div', 'sg-result__best', `個人最佳：${state.meta.selfstudy.scoreBest[BEST_KEY] || 0} 分`);
  panel.appendChild(bestLine);
  const again = el('button', 'ss-again', '再玩一場');
  again.type = 'button';
  again.addEventListener('click', showMenu);
  panel.appendChild(again);
  optionsEl.appendChild(panel);
}
