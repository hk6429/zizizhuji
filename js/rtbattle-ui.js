// 即時對戰 UI：房號配對＋1.5 秒輪詢＋「我方 vs 標靶」本機戰鬥。
// 傷害權威在攻擊方：我上報累計 dmg，對方血量 = 對方 hp − 我的 dmg。
// 戰鬥運算全走字字珠璣既有 kernel/adapter 管線（法寶/連對/寵物加成照舊），
// 只是把「答題結果」透過房間輪詢同步給另一台裝置，而不是跟本機墨靈打。
import { ZZAPI } from './meta/api.js';
import { ROUNDS, ROUND_SEC, POLL_MS, buildQuestions, dealtDamage, judge } from './meta/rtbattle.js';
import { getCtx, beginBattle, applyEliminate, showMolingLine, renderEvents } from './integration.js';
import { saveMeta } from './meta/store.js';
import * as kernel from './meta/kernel.js';
import { loadBank, getLevel } from './bank.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const HP_SCALE = 2; // 與 app.js startBattle 的血量倍率一致
// 本機「我方 vs 標靶」的假想對手血量：只是拿來讓 kernel/adapter 算傷害用，
// 設一個 20 題內打不穿的高血量，避免 Math.max(0, hpB-dmg) 提早封頂、吃掉後段題目的輸出。
const DUMMY_HP = 999999;
const STEMS = ['A', 'B', 'C', 'D'];

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const api = (body) => ZZAPI.call('/api/rt-room', { body });

let overlay, body, ctx;
let room = null, my = null, oppSnap = null, qs = [], st = null;
let pollTimer = 0, tickTimer = 0;

const gone = () => !body || !body.isConnected || overlay.hidden; // 使用者關閉 overlay 就停表，不留殭屍輪詢

function mySnap() {
  const maxHp = ctx.battle ? ctx.battle.mods.maxHp * HP_SCALE : 200;
  const nick = (ctx.meta.selfstudy.nick || ctx.meta.profile.name || '').trim() || '無名書生';
  const petId = ctx.meta.pet.active || '';
  return {
    nick: nick.slice(0, 12),
    petId,
    petName: (ctx.meta.pet.nicknames[petId] || '墨靈').slice(0, 8),
    lv: ctx.meta.pet.equipLevel[petId] || 1,
    hp: maxHp,
    scope: { bank: 'mixed', level: getLevel(), difficulty: 'all' },
  };
}

/* ---------- 開場：開房／加入 ---------- */

function offline(msg) {
  body.innerHTML = `<div class="rt-card">
    <p>📡 ${esc(msg || '連不上對戰伺服器，請稍後再試')}</p>
    <button id="rt-back-btn" class="overlay-ghost-btn" type="button">返回</button>
  </div>`;
  $('rt-back-btn').addEventListener('click', renderHome);
}

async function create() {
  ctx = getCtx();
  if (!ctx) return offline('遊戲還在載入中，請稍候再試');
  beginBattle(); // 建立 ctx.battle（法寶/寵物/天機修正），供 mySnap() 取 maxHp
  ctx.encounterOff = true; // 即時對戰要用種子化奇遇（Task 7），先關掉本機隨機擲骰避免雙方事件不同步
  my = mySnap();
  body.innerHTML = '<div class="rt-card"><p>開設對戰房間…</p></div>';
  const r = await api({ op: 'create', snap: my });
  if (gone()) return;
  if (!r || !r.ok) return offline(r && r.error);
  room = { code: r.code, role: 'p1', seed: r.seed };
  lobby();
}

async function join(code) {
  ctx = getCtx();
  if (!ctx) return offline('遊戲還在載入中，請稍候再試');
  beginBattle();
  ctx.encounterOff = true;
  my = mySnap();
  body.innerHTML = '<div class="rt-card"><p>加入房間…</p></div>';
  const r = await api({ op: 'join', code, snap: my });
  if (gone()) return;
  if (!r) return offline();
  if (!r.ok) return offline(r.error || '加不進去');
  room = { code, role: 'p2', seed: r.seed };
  oppSnap = r.opp;
  start();
}

function renderHome() {
  room = null; my = null; oppSnap = null; qs = []; st = null;
  body.innerHTML = `
    <div class="rt-home">
      <button id="rt-create-btn" class="overlay-ghost-btn" type="button">⚔️ 開新房</button>
      <p class="shuyuan-hint">或輸入同學的房號加入：</p>
      <div class="rt-join-row">
        <input id="rt-join-code" class="savesync-input" type="text" inputmode="numeric" maxlength="4" placeholder="4 位數房號">
        <button id="rt-join-btn" class="overlay-ghost-btn" type="button">加入</button>
      </div>
    </div>`;
  $('rt-create-btn').addEventListener('click', create);
  $('rt-join-btn').addEventListener('click', () => {
    const code = $('rt-join-code').value.trim();
    if (/^\d{4}$/.test(code)) join(code);
  });
}

/* 房主等待對手 */
function lobby() {
  let dots = 0;
  body.innerHTML = `<div class="rt-card">
    <p>房間開好了——請同學在「即時對戰」輸入房號：</p>
    <div class="rt-code">${esc(room.code)}</div>
    <p class="shuyuan-hint" id="rt-wait">等待對手加入…</p>
    <button id="rt-cancel-btn" class="overlay-ghost-btn" type="button">取消</button>
  </div>`;
  $('rt-cancel-btn').addEventListener('click', () => { stopTimers(); renderHome(); });
  pollTimer = setInterval(async () => {
    if (gone()) return stopTimers();
    const r = await api({ op: 'poll', code: room.code, role: 'p1' });
    if (gone()) return;
    const w = $('rt-wait');
    if (w) w.textContent = `等待對手加入${'.'.repeat((dots = (dots + 1) % 4))}`;
    if (r && r.ok && r.opp && r.opp.snap) {
      oppSnap = r.opp.snap;
      stopTimers();
      start();
    }
  }, POLL_MS);
}

/* ---------- 開打 ---------- */

async function start() {
  const bank = await loadBank('mixed'); // 雙方 scope 由房主 create 時決定，join 方跟隨
  if (gone()) return;
  qs = buildQuestions(room.seed, bank, ROUNDS);
  st = {
    round: 0, correct: 0, dmg: 0, done: false, locked: false, finished: false,
    state: { hpA: 100, hpB: DUMMY_HP, comboA: 0, comboB: 0 },
    oppDmg: 0, oppRound: 0, oppCombo: 0, oppDone: false, oppHb: Date.now(),
    q: null,
  };
  push();
  pollTimer = setInterval(poll, POLL_MS);
  nextRound();
}

function stopTimers() {
  clearInterval(pollTimer); clearInterval(tickTimer);
  pollTimer = 0; tickTimer = 0;
}

function myHp() { return Math.max(0, my.hp - st.oppDmg); }
function oppHp() { return oppSnap ? Math.max(0, oppSnap.hp - st.dmg) : 0; }

async function push() {
  await api({
    op: 'push', code: room.code, role: room.role,
    state: { dmg: st.dmg, round: st.round, combo: st.state.comboA, correct: st.correct, done: st.done ? 1 : 0 },
  });
}

async function poll() {
  if (gone()) return stopTimers();
  if (st.finished) return;
  const r = await api({ op: 'poll', code: room.code, role: room.role });
  if (gone() || st.finished) return;
  if (!r || !r.ok) return;
  if (r.opp && r.opp.state) {
    st.oppDmg = r.opp.state.dmg;
    st.oppRound = r.opp.state.round;
    st.oppCombo = r.opp.state.combo;
    st.oppDone = !!r.opp.state.done;
    st.oppHb = r.opp.hb;
    paintHud();
  }
  const verdict = judge({
    myHp: myHp(), oppHp: oppHp(), myDone: st.done, oppDone: st.oppDone,
    oppHbAgeMs: (r.opp && r.now) ? r.now - st.oppHb : 0,
  });
  if (verdict) finish(verdict);
}

function nextRound() {
  if (st.finished) return;
  if (st.round >= ROUNDS) {
    st.done = true;
    push();
    paintWaiting();
    return;
  }
  st.q = qs[st.round];
  st.locked = false;
  const deadline = Date.now() + ROUND_SEC * 1000;
  clearInterval(tickTimer);
  tickTimer = setInterval(() => {
    if (gone()) return stopTimers();
    if (st.finished) return clearInterval(tickTimer);
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const t = $('rt-timer');
    if (t) { t.textContent = `${left}s`; t.classList.toggle('is-low', left <= 5); }
    if (left <= 0 && !st.locked) answer(null);
  }, 250);
  paintQuestion(st.q, deadline);
}

function answer(v) {
  if (st.locked || st.finished) return;
  st.locked = true;
  const q = st.q;
  const correct = v !== null && v === q.answer;
  // 我方 vs 標靶：kernel 走 battle-adapter 疊法寶/護符/奇遇；ctx.encounterOff 已關掉隨機奇遇
  const prev = st.state;
  const r = kernel.onBattleAnswer(ctx, st.state, 'A', correct, q.id);
  st.state = r.state;
  renderEvents(r.events);
  st.dmg += dealtDamage(prev, st.state); // 累計輸出＝同步給對方的唯一數字
  if (correct) st.correct += 1;
  st.round += 1;
  push();
  const lg = $('rt-log');
  if (lg) lg.textContent = correct ? `⚔️ 命中！累計輸出 ${st.dmg}` : (v === null ? '⏰ 時間到——這題沒拿到傷害' : '❌ 答錯——沒造成傷害');
  setTimeout(() => { if (!gone() && !st.finished) nextRound(); }, 900);
}

/* ---------- 畫面 ---------- */

function hpBarHtml(hp, max) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((hp / max) * 100))) : 0;
  return `<div class="hp-track"><div class="hp-fill${pct <= 30 ? ' is-low' : ''}" style="width:${pct}%"></div></div>` +
    `<span class="hp-num">${hp}</span>`;
}

function paintHud() {
  const foe = $('rt-foehp');
  const me = $('rt-myhp');
  const pr = $('rt-opprog');
  if (foe && oppSnap) foe.innerHTML = hpBarHtml(oppHp(), oppSnap.hp);
  if (me) me.innerHTML = hpBarHtml(myHp(), my.hp);
  if (pr && oppSnap) pr.textContent = `${esc(oppSnap.nick)} 進度 ${Math.min(ROUNDS, st.oppRound)}/${ROUNDS}${st.oppCombo >= 2 ? `・連對 ×${st.oppCombo}` : ''}`;
}

function arenaHtml() {
  return `<div class="hp-side hp-side--b">
      <div class="hp-meta">
        <span class="hp-name">${esc(oppSnap.nick)} 的 ${esc(oppSnap.petName)}（Lv.${oppSnap.lv}）</span>
        <span id="rt-foehp">${hpBarHtml(oppHp(), oppSnap.hp)}</span>
      </div>
    </div>
    <p class="shuyuan-hint" id="rt-opprog">${esc(oppSnap.nick)} 進度 ${Math.min(ROUNDS, st.oppRound)}/${ROUNDS}</p>
    <div class="hp-side hp-side--a">
      <div class="hp-meta">
        <span class="hp-name">${esc(my.nick)} 的 ${esc(my.petName)}</span>
        <span id="rt-myhp">${hpBarHtml(myHp(), my.hp)}</span>
      </div>
    </div>
    <p class="shuyuan-hint" id="rt-log" role="status" aria-live="polite">第 ${Math.min(ROUNDS, st.round + 1)}/${ROUNDS} 題</p>`;
}

function paintQuestion(q, deadline) {
  const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  body.innerHTML = `<div class="rt-arena">${arenaHtml()}</div>
    <div class="rt-q">
      <div class="shuyuan-hint"><span id="rt-timer">${left}s</span>・第 ${st.round + 1}/${ROUNDS} 題</div>
      <p>${esc(q.question)}</p>
      <div id="rt-options"></div>
    </div>`;
  const optionsEl = $('rt-options');
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oath-btn';
    btn.textContent = `${STEMS[i] || i + 1}、${opt}`;
    btn.dataset.value = opt;
    optionsEl.appendChild(btn);
  });
  applyEliminate(optionsEl, q.answer); // 明目日/奇遇：劃掉錯誤選項（ctx.encounterOff 已關，仍保留法寶排除效果）
  optionsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn || !btn.dataset.value || btn.disabled) return;
    optionsEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    answer(btn.dataset.value);
  });
}

function paintWaiting() {
  body.innerHTML = `<div class="rt-arena">${arenaHtml()}</div>
    <div class="rt-card"><p>你已答完 ${ROUNDS} 題（答對 ${st.correct}）——等待對手收尾…</p></div>`;
}

function finish(verdict) {
  if (st.finished) return;
  st.finished = true;
  st.done = true;
  stopTimers();
  push();
  ctx.meta.ach.stats.battles += 1;
  if (verdict === 'win') ctx.meta.ach.stats.wins += 1;
  ctx.encounterOff = false; // 離開即時對戰，一般對戰要恢復隨機奇遇
  saveMeta(ctx.meta);
  const line = verdict === 'win' ? '贏了！這場打得漂亮～'
    : verdict === 'lose' ? '輸了也沒關係，把字記牢，下次贏回來'
    : '勢均力敵，平分秋色！';
  showMolingLine(line);
  const encourage = verdict === 'lose' ? '<p class="shuyuan-hint">積分不扣——把字記牢，下次贏回來</p>' : '';
  body.innerHTML = `<div class="rt-card">
    <p class="rt-result">${verdict === 'win' ? '🏆 你贏了！' : verdict === 'lose' ? '💀 惜敗' : '🤝 平手'}</p>
    <p>答對 ${st.correct}/${ROUNDS}・總輸出 ${st.dmg}</p>
    ${encourage}
    <button id="rt-again-btn" class="overlay-ghost-btn" type="button">再開一場</button>
  </div>`;
  $('rt-again-btn').addEventListener('click', renderHome);
}

/* ---------- overlay 開關 ---------- */

function close() {
  stopTimers();
  if (ctx) ctx.encounterOff = false;
  closeOverlay(overlay);
}

function open() {
  openOverlay(overlay, close);
  renderHome();
}

export function initRtBattleUI() {
  overlay = $('rt-overlay');
  body = $('rt-body');
  $('btn-rtbattle').addEventListener('click', open);
  $('rt-close-btn').addEventListener('click', close);
}
