// 積分競技（M2）：獨自衝分／對電腦／兩人對戰，共用 scoreEngine。
// 升級(base)×加倍(combo)×逐步升等×保險，規則全在 ./scoreEngine.js；本檔管 DOM。
// 題目用混合庫；字珠錢包（保險）走 meta/economy，存檔經 store.saveMeta。

import { saveMeta } from './meta/store.js';
import { spendPearls, getBalance } from './meta/economy.js';
import {
  createScoreState, answer, promote, canPromote, comboMultiplier,
  buyInsurance, TIERS, INSURANCE_COST,
} from './scoreEngine.js';
import { submitScore, fetchTop } from './leaderboard.js';
import { shuffle } from './shuffle.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';
import { buildHotseatShareText } from './meta/summary.js';
import { rushRankName } from './meta/rank-tier.js';
import { shouldCheckpoint } from './session-checkpoint.js';
import { playCorrect, playWrong } from './sound.js';

const CLASS_RE = /^[\w一-鿿]{1,20}$/;
const NICK_MAX = 12;
let metaRef = null; // 開站後由 ensureCtx 灌入，供班級設定讀寫

// 排行榜隱藏／自己比模式：裝置層級設定，怕排名造成後段孩子壓力的家長可開啟
const HIDE_RANKING_KEY = 'zizhu:hideRanking';
function hideRankingOn() {
  try { return localStorage.getItem(HIDE_RANKING_KEY) === '1'; } catch { return false; }
}
function setHideRanking(v) {
  try { localStorage.setItem(HIDE_RANKING_KEY, v ? '1' : '0'); } catch { /* 隱私模式下僅本次生效 */ }
}
function selfScoreKey(board) { return `zizhu:selfBestScore:${board}`; }
function getSelfPrevScore(board) {
  try {
    const n = Number(localStorage.getItem(selfScoreKey(board)));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}
function recordSelfScore(board, score) {
  try { localStorage.setItem(selfScoreKey(board), String(score)); } catch {}
}

const $ = (id) => document.getElementById(id);
function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

const ROUNDS = 10;        // 對電腦／兩人：每位真人各答 10 題
const CPU_ACC = 0.6;      // 電腦答對率
const TURN_DELAY = 700;
const AI_DELAY = 950;
const BEST_KEY = 'mixed';
const CHECKPOINT_EVERY = 15; // 獨自衝分每答 N 題問一次「要繼續嗎」
const WRONG_FLASH_DELAY = TURN_DELAY + 250 + 900; // 答錯多給約 1.15 秒看正解

// 答對照常速前進；答錯多留一段時間讓正解看得清楚
export function advanceDelay(correct) { return correct ? TURN_DELAY + 250 : WRONG_FLASH_DELAY; }

// 班級榜按讚：純前端、不落地、不連網的鼓勵效果（刻意不接後端，避免匿名分數榜被濫用）
const cheerCounts = new Map();

const MODES = [
  { id: 'solo',    name: '獨自衝分', icon: '🎯', desc: '一路答下去衝高分，答錯會扣分，隨時結束' },
  { id: 'vscpu',   name: '戰墨靈',   icon: '🤖', desc: `跟墨靈電腦各答 ${ROUNDS} 題，比總分` },
  { id: 'hotseat', name: '同硯對決', icon: '🆚', desc: `同一台輪流作答，各 ${ROUNDS} 題定勝負` },
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

async function open() {
  openOverlay($('scoregame-overlay'), close);
  try { const ctx = await deps.ensureCtx(); metaRef = ctx ? ctx.meta : null; } catch { metaRef = null; }
  showMenu();
}
function close() { clearTimers(); state = null; closeOverlay($('scoregame-overlay')); }

function showMenu() {
  clearTimers();
  state = null;
  $('sg-play').hidden = true;
  $('sg-lb').hidden = true;
  $('sg-menu').hidden = false;
  renderClassbar();
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

/* ---------- 班級排行榜（M3） ---------- */
function classInfo() {
  const ss = metaRef && metaRef.selfstudy;
  return { code: (ss && ss.classCode) || '', nick: (ss && ss.nick) || '' };
}

function appendHideRankingToggle(bar) {
  const wrap = el('label', 'sg-classbar__hide');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = hideRankingOn();
  cb.addEventListener('change', () => setHideRanking(cb.checked));
  wrap.appendChild(cb);
  wrap.appendChild(document.createTextNode('只看自己進步（隱藏排名）'));
  bar.appendChild(wrap);
}

function renderClassbar() {
  const bar = $('sg-classbar');
  bar.innerHTML = '';
  const { code, nick } = classInfo();
  if (code && nick) {
    const info = el('span', 'sg-classbar__info');
    info.innerHTML = `班級 <b>${escapeHtml(code)}</b>・${escapeHtml(nick)}`;
    const view = el('button', 'sg-classbar__btn', '看班級榜'); view.type = 'button';
    view.addEventListener('click', () => showLeaderboard(code));
    const edit = el('button', 'sg-classbar__btn sg-classbar__btn--ghost', '改'); edit.type = 'button';
    edit.addEventListener('click', renderClassForm);
    bar.append(info, view, edit);
  } else {
    const set = el('button', 'sg-classbar__btn', '設定班級・參加排行榜'); set.type = 'button';
    set.addEventListener('click', renderClassForm);
    bar.appendChild(set);
  }
  appendHideRankingToggle(bar);
}

function renderClassForm() {
  const bar = $('sg-classbar');
  bar.innerHTML = '';
  const { code, nick } = classInfo();
  const codeIn = el('input', 'sg-classbar__in'); codeIn.placeholder = '班級代碼(如601)'; codeIn.maxLength = 20; codeIn.value = code; codeIn.setAttribute('aria-label', '班級代碼');
  const nickIn = el('input', 'sg-classbar__in'); nickIn.placeholder = '暱稱'; nickIn.maxLength = NICK_MAX; nickIn.value = nick; nickIn.setAttribute('aria-label', '暱稱');
  const save = el('button', 'sg-classbar__btn', '儲存'); save.type = 'button';
  const priv = el('span', 'sg-classbar__hint', '暱稱會顯示在班級排行榜，請用綽號、勿填真實姓名');
  const err = el('span', 'sg-classbar__err', ''); err.setAttribute('aria-live', 'polite');
  save.addEventListener('click', () => {
    const c = codeIn.value.trim(), n = nickIn.value.trim().slice(0, NICK_MAX);
    if (!CLASS_RE.test(c)) { err.textContent = '班級代碼只能中英數、1–20 字'; return; }
    if (!n) { err.textContent = '請填暱稱'; return; }
    if (metaRef) { metaRef.selfstudy.classCode = c; metaRef.selfstudy.nick = n; saveMeta(metaRef); }
    renderClassbar();
  });
  bar.append(codeIn, nickIn, save, priv, err);
}

// 進步量／連續守燈子榜：跟主分數榜共用同一支 API，只是換一個 board 字串
// 讓弱勢學生也有機會上榜（進步最多／守燈最久），不是只有分數高的人才看得到自己
function boardKey(code, suffix) { return `${code}::${suffix}`; }

async function showLeaderboard(code) {
  $('sg-menu').hidden = true;
  const lb = $('sg-lb');
  lb.hidden = false;
  lb.innerHTML = '<p class="sg-lb__load">排行榜載入中…</p>';
  const [rScore, rProgress, rStreak] = await Promise.all([
    fetchTop(code), fetchTop(boardKey(code, 'progress')), fetchTop(boardKey(code, 'streak')),
  ]);
  renderAllBoards(lb, code, { rScore, rProgress, rStreak }, () => { lb.hidden = true; $('sg-menu').hidden = false; });
}

function renderLeaderboard(host, title, r, opts = {}) {
  host.appendChild(el('div', 'sg-lb__title', title));
  if (hideRankingOn()) {
    const { board, myScore } = opts;
    const prev = getSelfPrevScore(board);
    const best = Math.max(prev || 0, myScore || 0);
    let deltaTxt = '';
    if (prev != null && myScore != null) {
      const delta = myScore - prev;
      deltaTxt = delta > 0 ? `（本次 ${myScore} 分，較上次 +${delta}）`
        : delta < 0 ? `（本次 ${myScore} 分，較上次 ${delta}）`
        : `（本次 ${myScore} 分，跟上次一樣）`;
    } else if (myScore != null) {
      deltaTxt = `（本次 ${myScore} 分）`;
    }
    host.appendChild(el('p', 'sg-lb__self', best > 0 ? `你的最佳：${best} 分${deltaTxt}` : '還沒有紀錄，練習看看吧！'));
    if (myScore != null) recordSelfScore(board, myScore);
    return;
  }
  if (!r.ok) {
    host.appendChild(el('p', 'sg-lb__load', '排行榜暫時無法連線，稍後再試。'));
  } else if (!r.top.length) {
    host.appendChild(el('p', 'sg-lb__load', '還沒有人上榜，快去衝分！'));
  } else {
    const ol = el('ol', 'sg-lb__list');
    r.top.forEach((row) => {
      const li = el('li', 'sg-lb__row');
      li.innerHTML = `<span class="sg-lb__name">${escapeHtml(row.name)}</span><span class="sg-lb__score">${row.score}</span>`;
      const cheerKey = `${title}::${row.name}`;
      const cheer = el('button', 'sg-lb__cheer', `👍 ${cheerCounts.get(cheerKey) || ''}`.trim());
      cheer.type = 'button';
      cheer.title = '幫他加油（僅本機顯示，不會上傳）';
      cheer.addEventListener('click', () => {
        cheerCounts.set(cheerKey, (cheerCounts.get(cheerKey) || 0) + 1);
        cheer.textContent = `👍 ${cheerCounts.get(cheerKey)}`;
        floatMsg('+1', 'up');
      });
      li.appendChild(cheer);
      ol.appendChild(li);
    });
    host.appendChild(ol);
  }
}

function renderAllBoards(host, code, { rScore, rProgress, rStreak }, onClose, myScores = {}) {
  host.innerHTML = '';
  renderLeaderboard(host, `分數榜・${code}`, rScore, { board: code, myScore: myScores.score });
  renderLeaderboard(host, `進步量榜・${code}（單場進步最多）`, rProgress, { board: boardKey(code, 'progress'), myScore: myScores.progress });
  renderLeaderboard(host, `連續守燈榜・${code}（連續天數）`, rStreak, { board: boardKey(code, 'streak'), myScore: myScores.streak });
  if (onClose) {
    const back = el('button', 'ss-again', '關閉班級榜'); back.type = 'button';
    back.addEventListener('click', onClose);
    host.appendChild(back);
  }
}

/* ---------- 電腦回合 ---------- */
// 電腦命中率不再是固定值：依真人玩家目前的正確率浮動，玩家越強電腦跟著變強，樣本太少（<3題）先用預設值墊底
const CPU_ACC_MIN = 0.35;
const CPU_ACC_MAX = 0.85;
function dynamicCpuAcc(p) {
  const human = state.players.find((h) => !h.ai);
  if (!human || human.answered < 3) return p.acc;
  const humanAcc = human.score.correct / human.answered;
  return Math.max(CPU_ACC_MIN, Math.min(CPU_ACC_MAX, humanAcc));
}

function aiTurn(p) {
  $('sg-question').textContent = `${p.name}作答中…`;
  $('sg-options').innerHTML = '';
  later(() => {
    const correct = Math.random() < dynamicCpuAcc(p);
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
  shuffle(q.options).forEach((opt, i) => {
    const btn = el('button', 'sg-opt', null);
    btn.type = 'button';
    btn.dataset.value = opt;
    btn.setAttribute('aria-keyshortcuts', String(i + 1));
    const num = el('span', 'opt-num', `${i + 1}.`);
    num.setAttribute('aria-hidden', 'true');
    btn.appendChild(num);
    btn.appendChild(document.createTextNode(` ${opt}`));
    optionsEl.appendChild(btn);
  });
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
    if (correct) playCorrect(); else playWrong();
    const r = answer(p.score, correct);
    p.score = r.state;
    p.answered += 1;
    floatMsg(correct ? `＋${r.gain}${p.score.streak >= 3 ? ` 連${p.score.streak}` : ''}` : `答錯 −${r.penalty}`, correct ? 'gain' : 'pen');
    if (!correct) floatMsg(`正解：${q.answer}`, 'reveal');
    renderHud();
    advanceTurn();
    if (state.mode === 'solo' && shouldCheckpoint(p.answered, CHECKPOINT_EVERY)) {
      later(() => offerCheckpoint(p), advanceDelay(correct));
      return;
    }
    later(step, advanceDelay(correct));
  };
}

// 獨自衝分每答 N 題的非阻斷停頓點：問要繼續還是結束看成績，「結束」全程可用不受影響
function offerCheckpoint(p) {
  const optionsEl = $('sg-options');
  optionsEl.onclick = null;
  optionsEl.innerHTML = '';
  $('sg-question').textContent = `今日已答 ${p.answered} 題，要繼續嗎？`;
  const cont = el('button', 'sg-opt', '繼續衝分');
  cont.type = 'button';
  cont.addEventListener('click', step);
  const stop = el('button', 'sg-opt', '結束並看成績');
  stop.type = 'button';
  stop.addEventListener('click', () => results(true));
  optionsEl.append(cont, stop);
}

/* ---------- 成績 ---------- */
async function results(early) {
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
  const bestScore = state.meta.selfstudy.scoreBest[BEST_KEY] || 0;
  const bestLine = el('div', 'sg-result__best', `個人最佳：${bestScore} 分・${rushRankName(bestScore)}`);
  panel.appendChild(bestLine);
  if (state.mode === 'hotseat') {
    const share = el('button', 'ss-again sg-result__share', '複製戰報');
    share.type = 'button';
    share.addEventListener('click', async () => {
      const text = buildHotseatShareText(state.players);
      try {
        await navigator.clipboard.writeText(text);
        floatMsg('已複製戰報！', 'up');
      } catch {
        const ta = el('textarea', 'sg-result__sharefallback');
        ta.value = text;
        ta.readOnly = true;
        panel.appendChild(ta);
        ta.focus();
        ta.select();
        ta.addEventListener('blur', () => ta.remove(), { once: true });
      }
    });
    panel.appendChild(share);
  }
  const again = el('button', 'ss-again', '再玩一場');
  again.type = 'button';
  again.addEventListener('click', showMenu);
  panel.appendChild(again);
  optionsEl.appendChild(panel);

  // 班級排行榜：非同機兩人（單一裝置身分）時，上傳本人分數並顯示班級榜
  const { code, nick } = classInfo();
  if (code && nick && state.mode !== 'hotseat') {
    const human = state.players.find((p) => !p.ai);
    const lbBox = el('div', 'sg-lb sg-lb--inline');
    lbBox.innerHTML = '<p class="sg-lb__load">上傳班級榜…</p>';
    panel.appendChild(lbBox);

    const progress = Math.max(0, human.score.score - prevBest);
    const streak = (state.meta.daily && typeof state.meta.daily.streak === 'number') ? state.meta.daily.streak : 0;
    const [subScore, subProgress, subStreak] = await Promise.all([
      submitScore(code, nick, human.score.score),
      progress > 0 ? submitScore(boardKey(code, 'progress'), nick, progress) : Promise.resolve({ ok: true }),
      streak > 0 ? submitScore(boardKey(code, 'streak'), nick, streak) : Promise.resolve({ ok: true }),
    ]);
    const uploadFailed = !subScore.ok || !subProgress.ok || !subStreak.ok;
    const [rScore, rProgress, rStreak] = await Promise.all([
      subScore.ok ? Promise.resolve(subScore) : fetchTop(code),
      fetchTop(boardKey(code, 'progress')),
      fetchTop(boardKey(code, 'streak')),
    ]);
    renderAllBoards(lbBox, code, { rScore, rProgress, rStreak }, null, {
      score: human.score.score,
      progress: progress > 0 ? progress : undefined,
      streak: streak > 0 ? streak : undefined,
    });
    if (uploadFailed) {
      lbBox.appendChild(el('p', 'sg-lb__load', '本場分數目前僅記錄本機，班級榜暫時連不上，下次連線後再上傳。'));
    }
  }
}
