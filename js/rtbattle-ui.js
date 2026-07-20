// 即時對戰 UI：房號配對＋1.5 秒輪詢＋「我方 vs 標靶」本機戰鬥。
// 傷害權威在攻擊方：我上報累計 dmg，對方血量 = 對方 hp − 我的 dmg。
// 戰鬥運算全走字字珠璣既有 kernel/adapter 管線（法寶/連對/寵物加成照舊），
// 只是把「答題結果」透過房間輪詢同步給另一台裝置，而不是跟本機墨靈打。
import { ZZAPI } from './meta/api.js';
import { ROUNDS, ROUND_SEC, POLL_MS, buildQuestions, dealtDamage, judge, buildEncounterScript } from './meta/rtbattle.js';
import { safeBoard, buildLiveHerald } from './meta/livewall.js';
import { applyEncounterEffect } from './meta/battle-adapter.js';
import { getCtx, beginBattle, applyEliminate, showMolingLine, renderEvents } from './integration.js';
import { saveMeta } from './meta/store.js';
import * as kernel from './meta/kernel.js';
import { loadBank, getLevel, setLevel } from './bank.js';
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
const liveApi = (body) => ZZAPI.call('/api/rt-live', { body });

let overlay, body, ctx;
let room = null, my = null, oppSnap = null, qs = [], st = null;
let pollTimer = 0, tickTimer = 0;
let mode = 'live'; // 'live'＝即時 1v1（push/poll 同步）；'challenge'＝非同步應戰戰帖（單機打分數比大小）
let chInfo = null; // 應戰模式：{ code, challenger, score }（戰帖發起人暱稱與其輸出分數）

// 全班戰況牆（老師開房、全班同 seed 同題）：lv = { mode:'host'|'student', code, pin?, nick?, seed, qn, scope, phase, qNo }
let lv = null;
let lvPollTimer = 0, lvTickTimer = 0;
let lvBank = null, lvQs = [], lvCorrectCount = 0, lvLocked = false;

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

/* 應戰非同步戰帖：取戰帖 seed/scope → 同一套題目與奇遇腳本 → 單機打完 20 題 → 回報比分 */
async function acceptChallenge(code) {
  ctx = getCtx();
  if (!ctx) return offline('遊戲還在載入中，請稍候再試');
  body.innerHTML = '<div class="rt-card"><p>核對戰帖…</p></div>';
  const r = await api({ op: 'accept', code });
  if (gone()) return;
  if (!r || !r.ok) return offline((r && r.error) || '戰帖碼不對或已過期');
  if (r.scope && r.scope.level && r.scope.level !== getLevel()) setLevel(r.scope.level);
  beginBattle();
  ctx.encounterOff = true;
  my = mySnap();
  mode = 'challenge';
  chInfo = { code, challenger: r.challenger, score: r.score };
  oppSnap = { nick: r.challenger, petName: '戰帖靈', lv: 1, hp: DUMMY_HP };
  body.innerHTML = '<div class="rt-card"><p>載入題庫…</p></div>';
  const bank = await loadBank((r.scope && r.scope.bank) || 'mixed');
  if (gone()) return;
  qs = buildQuestions(r.seed, bank, ROUNDS);
  st = {
    round: 0, correct: 0, dmg: 0, done: false, locked: false, finished: false,
    state: { hpA: 100, hpB: DUMMY_HP, comboA: 0, comboB: 0 },
    oppDmg: 0, oppRound: ROUNDS, oppCombo: 0, oppDone: true, oppHb: Date.now(),
    q: null, encScript: buildEncounterScript(r.seed),
  };
  nextRound();
}

function renderHome() {
  stopTimers();
  room = null; my = null; oppSnap = null; qs = []; st = null; mode = 'live'; chInfo = null;
  lv = null; lvBank = null; lvQs = [];
  body.innerHTML = `
    <div class="rt-home">
      <button id="rt-create-btn" class="overlay-ghost-btn" type="button">⚔️ 開新房</button>
      <p class="shuyuan-hint">或輸入同學的房號加入：</p>
      <div class="rt-join-row">
        <input id="rt-join-code" class="savesync-input" type="text" inputmode="numeric" maxlength="4" placeholder="4 位數房號">
        <button id="rt-join-btn" class="overlay-ghost-btn" type="button">加入</button>
      </div>
      <p class="shuyuan-hint">收到戰帖？輸入 6 碼應戰：</p>
      <div class="rt-join-row">
        <input id="rt-ch-code" class="savesync-input" type="text" maxlength="6" placeholder="6 碼戰帖碼">
        <button id="rt-ch-btn" class="overlay-ghost-btn" type="button">應戰</button>
      </div>
      <p class="shuyuan-hint">全班一起打的隨堂戰況牆：</p>
      <div class="rt-join-row">
        <button id="lv-student-btn" class="overlay-ghost-btn" type="button">📡 隨堂戰況（學生）</button>
        <button id="lv-host-btn" class="overlay-ghost-btn" type="button">🧑‍🏫 我是主持人（老師）</button>
      </div>
    </div>`;
  $('rt-create-btn').addEventListener('click', create);
  $('rt-join-btn').addEventListener('click', () => {
    const code = $('rt-join-code').value.trim();
    if (/^\d{4}$/.test(code)) join(code);
  });
  $('rt-ch-btn').addEventListener('click', () => {
    const code = $('rt-ch-code').value.trim();
    if (/^[A-Za-z0-9]{6}$/.test(code)) acceptChallenge(code);
  });
  $('lv-student-btn').addEventListener('click', () => {
    ctx = getCtx();
    if (!ctx) return offline('遊戲還在載入中，請稍候再試');
    liveStudentForm();
  });
  $('lv-host-btn').addEventListener('click', () => {
    ctx = getCtx();
    if (!ctx) return offline('遊戲還在載入中，請稍候再試');
    liveHostForm();
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
    q: null, encScript: buildEncounterScript(room.seed),
  };
  push();
  pollTimer = setInterval(poll, POLL_MS);
  nextRound();
}

function stopTimers() {
  clearInterval(pollTimer); clearInterval(tickTimer);
  pollTimer = 0; tickTimer = 0;
  clearInterval(lvPollTimer); clearInterval(lvTickTimer);
  lvPollTimer = 0; lvTickTimer = 0;
}

function myHp() { return Math.max(0, my.hp - st.oppDmg); }
function oppHp() { return oppSnap ? Math.max(0, oppSnap.hp - st.dmg) : 0; }

async function push() {
  if (mode !== 'live') return; // 應戰模式是單機比分數，沒有房間可推送
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
    if (mode === 'challenge') return finishChallenge();
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
  maybeScriptedEncounter();
  push();
  const lg = $('rt-log');
  if (lg) lg.textContent = correct ? `⚔️ 命中！累計輸出 ${st.dmg}` : (v === null ? '⏰ 時間到——這題沒拿到傷害' : '❌ 答錯——沒造成傷害');
  setTimeout(() => { if (!gone() && !st.finished) nextRound(); }, 900);
}

// 種子化奇遇：同 seed 雙方在同一題後觸發同一事件，效果只落在自己這台的 ctx.battle。
function maybeScriptedEncounter() {
  const ev = st.encScript.get(st.round); // st.round 已 +1（= 已答題數）
  if (!ev) return;
  applyEncounterEffect(ctx.battle, ev);
  showMolingLine(`🎐 奇遇【${ev.name}】——${ev.desc}`);
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
    <button id="rt-challenge-btn" class="overlay-ghost-btn" type="button">📮 發挑戰書</button>
  </div>`;
  $('rt-again-btn').addEventListener('click', renderHome);
  $('rt-challenge-btn').addEventListener('click', sendChallenge);
}

// 把這場的輸出打包成非同步戰帖：同 seed／同 scope，讓對方之後任何時間單機應戰比分數
async function sendChallenge() {
  const btn = $('rt-challenge-btn');
  if (btn) { btn.disabled = true; btn.textContent = '發送中…'; }
  const r = await api({ op: 'challenge', seed: room.seed, scope: my.scope, nick: my.nick, score: st.dmg });
  if (!r || !r.ok) {
    if (btn) { btn.disabled = false; btn.textContent = '📮 發挑戰書'; }
    showMolingLine('發戰帖失敗，稍後再試');
    return;
  }
  const text = `⚔️ 字字珠璣挑戰書：${my.nick} 在同一組 20 題打出 ${st.dmg} 輸出——到「即時對戰」輸入挑戰碼 ${r.code} 應戰！（7 天內有效）`;
  try {
    await navigator.clipboard.writeText(text);
    showMolingLine('戰帖已複製到剪貼簿，貼給同學應戰吧！');
  } catch {
    showMolingLine(`戰帖碼：${r.code}（複製失敗，手動抄下吧）`);
  }
  if (btn) { btn.disabled = false; btn.textContent = '📮 已發送'; }
}

// 應戰模式收尾：回報成績給伺服器、比大小、顯示雙方輸出
async function finishChallenge() {
  if (st.finished) return;
  st.finished = true;
  stopTimers();
  ctx.meta.ach.stats.battles += 1;
  const win = st.dmg > chInfo.score;
  const tie = st.dmg === chInfo.score;
  if (win) ctx.meta.ach.stats.wins += 1;
  ctx.encounterOff = false;
  saveMeta(ctx.meta);
  await api({ op: 'challengeResult', code: chInfo.code, nick: my.nick, score: st.dmg });
  const line = win ? '應戰成功，打贏了戰帖！' : tie ? '打成平手，勢均力敵！' : '這次輸給戰帖了，練練再回來';
  showMolingLine(line);
  body.innerHTML = `<div class="rt-card">
    <p class="rt-result">${win ? '🏆 應戰成功！' : tie ? '🤝 平手' : '💀 惜敗於戰帖'}</p>
    <p>${esc(chInfo.challenger)} 的輸出：${chInfo.score}</p>
    <p>你的輸出：${st.dmg}（答對 ${st.correct}/${ROUNDS}）</p>
    <button id="rt-again-btn" class="overlay-ghost-btn" type="button">返回</button>
  </div>`;
  $('rt-again-btn').addEventListener('click', renderHome);
}

/* ---------- 全班戰況牆：老師主持面板 ---------- */

function liveHostForm() {
  body.innerHTML = `<div class="rt-card">
    <p>🧑‍🏫 開設全班隨堂戰況——輸入班級碼與自訂主持碼：</p>
    <div class="rt-join-row"><input id="lv-code" class="savesync-input" type="text" maxlength="16" placeholder="班級碼（如 五年三班）"></div>
    <div class="rt-join-row"><input id="lv-pin" class="savesync-input" type="text" inputmode="numeric" maxlength="8" placeholder="自訂主持碼（4–8 位數字）"></div>
    <div class="rt-join-row">
      <label class="shuyuan-hint" for="lv-qn">題數：</label>
      <select id="lv-qn"><option value="5">5</option><option value="10" selected>10</option><option value="15">15</option></select>
    </div>
    <button id="lv-start-btn" class="overlay-ghost-btn" type="button">開場</button>
    <button id="rt-back-btn" class="overlay-ghost-btn" type="button">返回</button>
  </div>`;
  $('rt-back-btn').addEventListener('click', renderHome);
  $('lv-start-btn').addEventListener('click', async () => {
    const code = $('lv-code').value.trim();
    const pin = $('lv-pin').value.trim();
    const qn = Number($('lv-qn').value);
    if (!code) return;
    if (!/^\d{4,8}$/.test(pin)) return;
    const scope = { bank: 'mixed', level: getLevel(), difficulty: 'all' };
    body.innerHTML = '<div class="rt-card"><p>開場中…</p></div>';
    const r = await liveApi({ op: 'start', code, pin, qn, scope });
    if (gone()) return;
    if (!r || !r.ok) return offline(r && r.error);
    lv = { mode: 'host', code, pin, ...r.live };
    liveHostPanel();
  });
}

function liveStatusText() {
  if (lv.phase === 'lobby') return '尚未開始';
  if (lv.phase === 'q') return `第 ${lv.qNo}/${lv.qn} 題`;
  return '已結束';
}

function liveHostPanel() {
  clearInterval(lvPollTimer);
  body.innerHTML = `<div class="rt-card">
    <p>班級碼 <b>${esc(lv.code)}</b>・主持碼 ${esc(lv.pin)}</p>
    <p class="shuyuan-hint" id="lv-status">階段：${liveStatusText()}</p>
    <p class="shuyuan-hint" id="lv-answered">已答：0 人</p>
    <button id="lv-next-btn" class="overlay-ghost-btn" type="button">${lv.phase === 'end' ? '查看戰報' : '下一題'}</button>
    <button id="lv-end-btn" class="overlay-ghost-btn" type="button">結束</button>
  </div>`;
  $('lv-next-btn').addEventListener('click', async () => {
    if (lv.phase === 'end') return liveHostShowEnd();
    const r = await liveApi({ op: 'next', code: lv.code, pin: lv.pin });
    if (gone()) return;
    if (!r || !r.ok) return;
    lv = { ...lv, ...r.live };
    if (lv.phase === 'end') return liveHostShowEnd();
    liveHostPanel();
  });
  $('lv-end-btn').addEventListener('click', async () => {
    const r = await liveApi({ op: 'end', code: lv.code, pin: lv.pin });
    if (gone()) return;
    if (!r || !r.ok) return;
    lv = { ...lv, ...r.live };
    liveHostShowEnd();
  });
  lvPollTimer = setInterval(async () => {
    if (gone()) return clearInterval(lvPollTimer);
    const r = await liveApi({ op: 'roster', code: lv.code });
    if (gone() || !r || !r.ok) return;
    const answered = lv.qNo > 0 ? r.list.filter((x) => x.qNo >= lv.qNo).length : 0;
    const el = $('lv-answered');
    if (el) el.textContent = `已答：${answered} 人`;
  }, 3000);
}

async function liveHostShowEnd() {
  clearInterval(lvPollTimer);
  const r = await liveApi({ op: 'roster', code: lv.code });
  if (gone()) return;
  const rows = (r && r.list) || [];
  const board = safeBoard(rows, '', 5);
  const herald = buildLiveHerald({ week: new Date().toISOString().slice(0, 10), rows });
  body.innerHTML = `<div class="rt-card">
    ${herald.map((l) => `<p>${esc(l)}</p>`).join('')}
    <ol class="rt-live-board">${board.top.map((x) => `<li>${esc(x.nick)}・答對 ${x.score} 題</li>`).join('')}</ol>
    <button id="rt-again-btn" class="overlay-ghost-btn" type="button">返回</button>
  </div>`;
  $('rt-again-btn').addEventListener('click', renderHome);
}

/* ---------- 全班戰況牆：學生入班答題 ---------- */

function liveStudentForm() {
  const prefillCode = ctx.meta.selfstudy.classCode || '';
  const prefillNick = ctx.meta.selfstudy.nick || '';
  body.innerHTML = `<div class="rt-card">
    <p>📡 加入全班隨堂戰況：</p>
    <div class="rt-join-row"><input id="lv-s-code" class="savesync-input" type="text" maxlength="16" placeholder="班級碼" value="${esc(prefillCode)}"></div>
    <div class="rt-join-row"><input id="lv-s-nick" class="savesync-input" type="text" maxlength="12" placeholder="暱稱" value="${esc(prefillNick)}"></div>
    <button id="lv-s-join-btn" class="overlay-ghost-btn" type="button">加入</button>
    <button id="rt-back-btn" class="overlay-ghost-btn" type="button">返回</button>
  </div>`;
  $('rt-back-btn').addEventListener('click', renderHome);
  $('lv-s-join-btn').addEventListener('click', () => {
    const code = $('lv-s-code').value.trim();
    const nick = $('lv-s-nick').value.trim().slice(0, 12);
    if (!code || !nick) return;
    ctx.meta.selfstudy.classCode = code;
    ctx.meta.selfstudy.nick = nick;
    saveMeta(ctx.meta);
    lv = { mode: 'student', code, nick, qNo: 0, phase: 'lobby' };
    lvBank = null; lvQs = []; lvCorrectCount = 0;
    liveStudentWait();
  });
}

function liveStudentWait() {
  clearInterval(lvPollTimer);
  body.innerHTML = '<div class="rt-card"><p>等待老師開始隨堂戰況…</p></div>';
  lvPollTimer = setInterval(liveStudentPoll, POLL_MS * 2);
  liveStudentPoll();
}

async function liveStudentPoll() {
  if (gone()) return clearInterval(lvPollTimer);
  const r = await liveApi({ op: 'state', code: lv.code });
  if (gone() || !r || !r.ok || !r.live) return;
  const prevQNo = lv.qNo;
  lv = { ...lv, ...r.live };
  if (lv.phase === 'end') {
    clearInterval(lvPollTimer);
    return liveStudentEnd();
  }
  if (lv.phase === 'q' && lv.qNo !== prevQNo) await liveStudentLoadQuestion();
}

async function liveStudentLoadQuestion() {
  clearInterval(lvPollTimer); // 出題期間停輪詢，答完再恢復
  if (!lvBank) {
    if (lv.scope && lv.scope.level && lv.scope.level !== getLevel()) setLevel(lv.scope.level);
    lvBank = await loadBank((lv.scope && lv.scope.bank) || 'mixed');
    if (gone()) return;
    lvQs = buildQuestions(lv.seed, lvBank, lv.qn);
  }
  const q = lvQs[lv.qNo - 1];
  if (!q) return liveStudentResume();
  lvLocked = false;
  paintLiveQuestion(q, Date.now() + ROUND_SEC * 1000);
}

function paintLiveQuestion(q, deadline) {
  body.innerHTML = `<div class="rt-q">
    <div class="shuyuan-hint"><span id="lv-timer">${ROUND_SEC}s</span>・第 ${lv.qNo}/${lv.qn} 題</div>
    <p>${esc(q.question)}</p>
    <div id="lv-options"></div>
  </div>`;
  const optionsEl = $('lv-options');
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oath-btn';
    btn.textContent = `${STEMS[i] || i + 1}、${opt}`;
    btn.dataset.value = opt;
    optionsEl.appendChild(btn);
  });
  optionsEl.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn || lvLocked) return;
    optionsEl.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    liveStudentAnswer(btn.dataset.value === q.answer);
  });
  clearInterval(lvTickTimer);
  lvTickTimer = setInterval(() => {
    if (gone()) return clearInterval(lvTickTimer);
    const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const t = $('lv-timer');
    if (t) t.textContent = `${left}s`;
    if (left <= 0 && !lvLocked) liveStudentAnswer(false);
  }, 250);
}

async function liveStudentAnswer(correct) {
  if (lvLocked) return;
  lvLocked = true;
  clearInterval(lvTickTimer);
  if (correct) lvCorrectCount += 1;
  await liveApi({ op: 'answer', code: lv.code, nick: lv.nick, qNo: lv.qNo, correct });
  if (gone()) return;
  liveStudentResume();
}

function liveStudentResume() {
  body.innerHTML = `<div class="rt-card"><p>已作答第 ${lv.qNo} 題（答對 ${lvCorrectCount} 題）——等待老師下一題…</p></div>`;
  lvPollTimer = setInterval(liveStudentPoll, POLL_MS * 2);
}

async function liveStudentEnd() {
  const r = await liveApi({ op: 'roster', code: lv.code });
  if (gone()) return;
  const rows = (r && r.list) || [];
  const board = safeBoard(rows, lv.nick, 5);
  body.innerHTML = `<div class="rt-card">
    <p>🏁 隨堂戰況結束！</p>
    <ol class="rt-live-board">${board.top.map((x) => `<li>${esc(x.nick)}・答對 ${x.score} 題</li>`).join('')}</ol>
    ${board.me ? `<p>你是第 ${board.me.rank} 名・答對 ${board.me.score} 題</p>` : ''}
    <p class="shuyuan-hint">跟上一場的自己比就是進步</p>
    <button id="rt-again-btn" class="overlay-ghost-btn" type="button">返回</button>
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
