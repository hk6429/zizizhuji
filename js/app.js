// zizizhuji/js/app.js
import { BANK_SOURCES, fetchBank, loadBank, getLevel, setLevel } from './bank.js';
import { nextQuestionId } from './leitner.js';
import * as kernel from './meta/kernel.js';
import {
  ensureMeta, getCtx, getToday, refreshWidgets, bindDailyBox,
  renderEvents, renderSummary, syncPets,
  beginBattle, battleOver, applyEliminate, hideMolingBubble,
} from './integration.js';
import { initPetUI } from './pet-ui.js';
import { initSelfStudy } from './selfstudy-ui.js';
import { initScoreGame } from './scoregame-ui.js';
import { initAchievementsUI } from './achievements-ui.js';
import { initSaveSyncUI } from './save-sync-ui.js';
import { saveMeta } from './meta/store.js';
import { checkWelcomeBack } from './meta/welcome-back.js';
import { shuffle } from './shuffle.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const FEEDBACK_DELAY = 800; // 等墨暈／潑濺動畫播完再進下一題（對齊 goldGlow/inkBloom .8s）

let currentBank = 'ziyin';
let currentDifficulty = 'all'; // 'all' | '易' | '中' | '難'
let session = 0; // 收卷／重新開局時 +1，讓舊回合的 setTimeout 失效
let currentMode = null;    // 'practice' | 'battle' | null
let battleState = null;    // 對戰中的 state（收卷結算用）
let battleDone = false;    // 防止 onBattleEnd 重複呼叫

// 無傷模式：關閉連擊嗆聲與低血警示視覺，降低對戰對弱勢學生的心理壓力
const NODAMAGE_KEY = 'zizhu:noDamageMode';
let noDamageMode = localStorage.getItem(NODAMAGE_KEY) === '1';
const ndToggle = document.getElementById('toggle-nodamage');
if (ndToggle) {
  ndToggle.checked = noDamageMode;
  ndToggle.addEventListener('change', () => {
    noDamageMode = ndToggle.checked;
    localStorage.setItem(NODAMAGE_KEY, noDamageMode ? '1' : '0');
  });
}

const $ = (id) => document.getElementById(id);

/* ---------- 學制切換 ---------- */
// 國中題數待內容產出批次完成後回填（見 data/ziyin-zixing-junior.json / chengyu-junior.json 實際筆數）。
const BANK_COUNTS = {
  國小: { ziyin: 1532, chengyu: 434, mixed: 1966 },
  國中: { ziyin: 1208, chengyu: 414, mixed: 1622 },
};

function renderBankCounts() {
  const counts = BANK_COUNTS[getLevel()];
  $('bank-count-ziyin').textContent = `${counts.ziyin} 題`;
  $('bank-count-chengyu').textContent = `${counts.chengyu} 題`;
  $('bank-count-mixed').textContent = `${counts.mixed} 題`;
}

const levelButtons = document.querySelectorAll('#level-select .level-btn');
for (const btn of levelButtons) {
  btn.classList.toggle('is-active', btn.dataset.level === getLevel());
  btn.setAttribute('aria-pressed', String(btn.dataset.level === getLevel()));
  btn.addEventListener('click', () => {
    if (setLevel(btn.dataset.level)) location.reload();
  });
}
renderBankCounts();

const loadCurrentBank = async () => {
  const bank = await loadBank(currentBank);
  if (currentDifficulty === 'all') return bank;
  const filtered = bank.filter((q) => q.difficulty === currentDifficulty);
  return filtered.length ? filtered : bank; // 篩到空題庫時退回全部，避免卡關
};

const diffButtons = document.querySelectorAll('#diff-select .diff-btn');
for (const btn of diffButtons) {
  btn.addEventListener('click', () => {
    currentDifficulty = btn.dataset.diff;
    for (const b of diffButtons) b.classList.toggle('is-active', b === btn);
  });
}

// 兩份題庫齊備後初始化機制層（八角 meta）。失敗（離線）不擋原有遊玩入口。
async function initMetaLayer() {
  if (getCtx()) return getCtx();
  try {
    const [ziyin, chengyu] = await Promise.all(
      BANK_SOURCES[getLevel()].mixed.map((src) => fetchBank(src.path, src.kind))
    );
    return ensureMeta({ ziyin, chengyu });
  } catch (err) {
    console.warn('[字字珠璣] 機制層初始化失敗（題庫未載入）', err);
    return null;
  }
}

// 題庫載入失敗（離線/路徑錯）時顯示獨立錯誤卡，不佔用答題版位，可原地重試
function showLoadError(mode) {
  const overlay = $('load-error-overlay');
  const back = () => closeOverlay(overlay);
  $('load-error-retry').onclick = () => {
    closeOverlay(overlay);
    if (mode === 'practice') startPractice(); else startBattle();
  };
  $('load-error-back').onclick = back;
  openOverlay(overlay, back);
}

/* ---------- 題庫切換 ---------- */
const bankCards = {
  ziyin: $('bank-ziyin'),
  chengyu: $('bank-chengyu'),
  mixed: $('bank-mixed'),
};
for (const [key, card] of Object.entries(bankCards)) {
  card.addEventListener('click', () => {
    currentBank = key;
    for (const [k, c] of Object.entries(bankCards)) {
      c.classList.toggle('is-active', k === key);
      c.setAttribute('aria-pressed', String(k === key));
    }
  });
}

/* ---------- 畫面切換 ---------- */
function enterQuiz(mode) {
  session += 1;
  currentMode = mode;
  document.body.classList.add('in-quiz');
  document.body.classList.remove('mode-practice', 'mode-battle');
  document.body.classList.add(`mode-${mode}`);
  $('quiz-area').hidden = false;
  $('battle-hud').hidden = mode !== 'battle';
  $('mode-tag').textContent = mode === 'battle' ? '對戰' : '練習';
  return session;
}

// 收卷：先結算本回合（戰報卷軸），再回首頁
function finishSession() {
  const ctx = getCtx();
  if (!ctx) return;
  if (currentMode === 'practice') {
    const answered = ctx.session.total > 0;
    const { summary } = kernel.onPracticeEnd(ctx);
    if (answered) renderSummary(summary);
  } else if (currentMode === 'battle' && !battleDone && battleState) {
    battleDone = true;
    if (ctx.session.total === 0) {
      kernel.onPracticeEnd(ctx); // 一題未答就收卷：只重置 session，不計一場對戰
      return;
    }
    const { summary, events } = kernel.onBattleEnd(ctx, battleState);
    renderEvents(events);
    renderSummary(summary);
  }
}

function backHome() {
  finishSession();
  session += 1;
  currentMode = null;
  battleState = null;
  hideMolingBubble();
  document.body.classList.remove('in-quiz', 'mode-practice', 'mode-battle');
  $('quiz-area').hidden = true;
  $('battle-hud').hidden = true;
  const optionsEl = $('options');
  optionsEl.onclick = null;
  optionsEl.innerHTML = '';
  $('question-text').textContent = '';
  refreshWidgets();
}
$('btn-back').addEventListener('click', backHome);

/* ---------- 出題與回饋 ---------- */
function renderQuestion(entry) {
  $('question-text').textContent = entry.question;
  const optionsEl = $('options');
  optionsEl.innerHTML = '';
  entry.options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opt;
    btn.dataset.value = opt;
    optionsEl.appendChild(btn);
  });
}

function bindAnswer(entry, mySession, onDone) {
  const optionsEl = $('options');
  optionsEl.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn || !btn.dataset.value || btn.disabled) return;
    optionsEl.onclick = null;
    const correct = btn.dataset.value === entry.answer;
    const buttons = optionsEl.querySelectorAll('button');
    buttons.forEach((b) => { b.disabled = true; });
    btn.classList.add(correct ? 'correct' : 'wrong');
    if (!correct) {
      for (const b of buttons) {
        if (b.dataset.value === entry.answer) { b.classList.add('reveal'); break; }
      }
    }
    setTimeout(() => {
      if (mySession !== session) return; // 已收卷或重新開局
      onDone(correct);
    }, FEEDBACK_DELAY);
  };
}

/* ---------- 對戰 HUD ---------- */
function renderHpSide(fillEl, numEl, hp, maxHp = 100) {
  fillEl.style.width = `${Math.max(0, Math.min(100, (hp / maxHp) * 100))}%`;
  fillEl.classList.toggle('is-low', !noDamageMode && hp <= maxHp * 0.3);
  numEl.textContent = hp;
}

function renderBattleHud(state, maxHpA = 100, maxHpB = 100) {
  renderHpSide($('hp-a'), $('hp-num-a'), state.hpA, maxHpA);
  renderHpSide($('hp-b'), $('hp-num-b'), state.hpB, maxHpB);
  const combo = $('combo');
  // 答對打斷對手連擊、答錯歸零自己連擊，兩者互斥，共用同一枚印章
  // 無傷模式關閉「對手連擊」嗆聲，只顯示自己的連對數，避免落後時被動加壓
  const rivalStreak = !noDamageMode && state.comboA === 0 && state.comboB >= 2;
  combo.textContent = rivalStreak ? `對手連擊 ${state.comboB}` : `連對 ${state.comboA}`;
  combo.hidden = state.comboA < 2 && !rivalStreak; // 連對 0/1 不佔版面
  combo.classList.toggle('is-rival', rivalStreak);
  combo.classList.toggle('is-hot', !noDamageMode && (state.comboA >= 3 || state.comboB >= 3));
  if (!combo.hidden) {
    combo.classList.remove('pop');
    void combo.offsetWidth; // 重播印章跳出動畫
    combo.classList.add('pop');
  }
}

/* ---------- 練習修行（Leitner） ---------- */
async function startPractice() {
  let bank;
  try {
    bank = await loadCurrentBank();
    await initMetaLayer();
  } catch (err) {
    console.error('[字字珠璣] 題庫載入失敗', err);
    showLoadError('practice');
    return;
  }
  if (!bank.length) return;
  const ctx = getCtx();
  if (!ctx) { showLoadError('practice'); return; }
  const mySession = enterQuiz('practice');

  const ids = shuffle(bank.map((e) => e.id)); // 洗牌，避免近似成語同組連續出現
  const state = ctx.leitner; // 由 kernel 供給：含上次遊玩的盒位，不再每次歸零
  const byId = new Map(bank.map((e) => [e.id, e]));
  let lastId = null;

  function nextRound() {
    // 排除剛答過的那題再選，避免它是唯一低盒題時立刻重複
    const pool = ids.length > 1 ? ids.filter((x) => x !== lastId) : ids;
    const id = nextQuestionId(state, pool);
    const entry = byId.get(id);
    renderQuestion(entry);
    bindAnswer(entry, mySession, (correct) => {
      // kernel 內部已呼叫 leitner.recordAnswer ＋持久化，此處不可再 recordAnswer
      const { events } = kernel.onPracticeAnswer(ctx, id, correct);
      renderEvents(events);
      syncPets(); // 精通題數可能剛跨過解鎖門檻
      lastId = id;
      nextRound();
    });
  }
  nextRound();
}

/* ---------- 墨靈對戰 ---------- */
async function startBattle() {
  let bank;
  try {
    bank = await loadCurrentBank();
    await initMetaLayer();
  } catch (err) {
    console.error('[字字珠璣] 題庫載入失敗', err);
    showLoadError('battle');
    return;
  }
  if (!bank.length) return;
  const ctx = getCtx();
  if (!ctx) { showLoadError('battle'); return; }
  const mySession = enterQuiz('battle');

  battleDone = false;
  let state = beginBattle(); // adapter 產 state（法寶/天機修正）＋墨靈開場白
  // 對戰題數加倍：雙方血量 ×2，傷害不變 → 一回合題數約翻倍，輸贏成就感更強
  const HP_SCALE = 2;
  const baseHpB = state.hpB;
  state = { ...state, hpA: state.hpA * HP_SCALE, hpB: state.hpB * HP_SCALE };
  battleState = state;
  const maxHpA = ctx.battle.mods.maxHp * HP_SCALE;
  const maxHpB = baseHpB * HP_SCALE;
  renderBattleHud(state, maxHpA, maxHpB);
  const queue = shuffle(bank);
  let idx = 0;

  function endBattle() {
    battleDone = true;
    const { summary, events } = kernel.onBattleEnd(ctx, state);
    renderEvents(events);

    // 題卡收尾畫面（結算卡疊在上面）
    let text;
    if (state.hpB <= 0 || state.hpA > state.hpB) {
      text = '小書生獲勝！墨靈少女甘拜下風～';
    } else if (state.hpA <= 0 || state.hpB > state.hpA) {
      text = '墨靈少女獲勝！收卷再修行一回吧！';
    } else {
      text = '勢均力敵，平分秋色！再戰一回分高下！';
    }
    $('question-text').textContent = text;
    const optionsEl = $('options');
    optionsEl.onclick = null;
    optionsEl.innerHTML = '';
    const emblem = document.createElement('img');
    emblem.src = 'assets/web/emblem.jpg';
    emblem.alt = '';
    emblem.className = 'result-emblem';
    optionsEl.appendChild(emblem);

    renderSummary(summary);
  }

  function nextRound() {
    if (battleOver(state) || idx >= queue.length) {
      endBattle();
      return;
    }
    const entry = queue[idx++];
    renderQuestion(entry);
    applyEliminate($('options'), entry.answer); // 明目日/奇遇：劃掉錯誤選項
    bindAnswer(entry, mySession, (correct) => {
      // kernel 經 battle-adapter 呼叫 applyAnswer 並疊加法寶/護符/奇遇，不可再自己 applyAnswer
      const rA = kernel.onBattleAnswer(ctx, state, 'A', correct, entry.id);
      renderEvents(rA.events);
      // 答對打斷對手連擊；答錯換對手出招（沿用原版節奏）
      const rB = kernel.onBattleAnswer(ctx, rA.state, 'B', !correct);
      renderEvents(rB.events);
      syncPets(); // 精通題數可能剛跨過解鎖門檻
      state = rB.state;
      battleState = state;
      renderBattleHud(state, maxHpA, maxHpB);
      nextRound();
    });
  }
  nextRound();
}

$('btn-practice').addEventListener('click', startPractice);
$('btn-battle').addEventListener('click', startBattle);

// 回歸玩家迎接：非阻斷、不提斷簽損失，一天只顯示一次（用獨立 key，不進 zzj_meta schema）
const WELCOME_SHOWN_KEY = 'zizhu:lastWelcomeShown';
function maybeShowWelcomeBack() {
  const ctx = getCtx();
  if (!ctx) return;
  const today = getToday();
  let shownToday = false;
  try { shownToday = localStorage.getItem(WELCOME_SHOWN_KEY) === today; } catch {}
  if (shownToday) return;
  const { show, daysAway } = checkWelcomeBack(ctx.meta, today);
  if (!show) return;
  $('welcomeback-msg').textContent = `休息 ${daysAway} 天也沒關係，墨燈一直等著你`;
  const close = () => closeOverlay($('welcomeback-overlay'));
  $('welcomeback-close').addEventListener('click', close, { once: true });
  openOverlay($('welcomeback-overlay'), close);
  try { localStorage.setItem(WELCOME_SHOWN_KEY, today); } catch {}
}

/* ---------- 開站 ---------- */
const ensureCtx = async () => { await initMetaLayer(); return getCtx(); };
bindDailyBox();
initPetUI({ getMeta: () => getCtx()?.meta, onChange: refreshWidgets });
initSelfStudy({ loadBank, ensureCtx });
initScoreGame({ loadBank, ensureCtx, onChange: refreshWidgets });
initAchievementsUI({ getMeta: () => getCtx()?.meta });
initSaveSyncUI({
  getMeta: () => getCtx()?.meta,
  onLoaded: (data) => { saveMeta(data); location.reload(); },
});
initMetaLayer().then(maybeShowWelcomeBack);
