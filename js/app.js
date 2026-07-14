// zizizhuji/js/app.js
import { loadQuizBank } from './quiz-loader.js';
import { createLeitnerState, recordAnswer, nextQuestionId } from './leitner.js';
import { createBattleState, applyAnswer, isBattleOver } from './battle.js';

const FEEDBACK_DELAY = 650; // 等墨暈／潑濺動畫播完再進下一題

const BANK_SOURCES = {
  ziyin:   [{ path: 'data/ziyin-zixing-elementary.json', kind: 'ziyin' }],
  chengyu: [{ path: 'data/chengyu-elementary.json', kind: 'chengyu' }],
  mixed: [
    { path: 'data/ziyin-zixing-elementary.json', kind: 'ziyin' },
    { path: 'data/chengyu-elementary.json', kind: 'chengyu' },
  ],
};

let currentBank = 'ziyin';
let session = 0; // 收卷／重新開局時 +1，讓舊回合的 setTimeout 失效

const $ = (id) => document.getElementById(id);

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function fetchBank(path, kind) {
  const res = await fetch(path);
  const raw = await res.json();
  const { usable, rejected } = loadQuizBank(raw, kind);
  if (rejected.length) {
    console.warn(`[字字珠璣] ${path} 有 ${rejected.length} 筆題目未通過驗證，已排除`, rejected);
  }
  return usable;
}

async function loadCurrentBank() {
  const parts = await Promise.all(
    BANK_SOURCES[currentBank].map((src) => fetchBank(src.path, src.kind))
  );
  return parts.flat();
}

// 題庫載入失敗（離線/路徑錯）時進答題頁顯示訊息，玩家可按「收卷」返回
function showLoadError(mode) {
  enterQuiz(mode);
  $('battle-hud').hidden = true;
  $('question-text').textContent = '題庫載入失敗了，請檢查網路後收卷再試一次。';
  $('options').innerHTML = '';
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
  document.body.classList.add('in-quiz');
  document.body.classList.remove('mode-practice', 'mode-battle');
  document.body.classList.add(`mode-${mode}`);
  $('quiz-area').hidden = false;
  $('battle-hud').hidden = mode !== 'battle';
  $('mode-tag').textContent = mode === 'battle' ? '對戰' : '練習';
  return session;
}

function backHome() {
  session += 1;
  document.body.classList.remove('in-quiz', 'mode-practice', 'mode-battle');
  $('quiz-area').hidden = true;
  $('battle-hud').hidden = true;
  const optionsEl = $('options');
  optionsEl.onclick = null;
  optionsEl.innerHTML = '';
  $('question-text').textContent = '';
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
    if (!btn || !btn.dataset.value) return;
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
function renderHpSide(fillEl, numEl, hp) {
  fillEl.style.width = `${hp}%`;
  fillEl.classList.toggle('is-low', hp <= 30);
  numEl.textContent = hp;
}

function renderBattleHud(state) {
  renderHpSide($('hp-a'), $('hp-num-a'), state.hpA);
  renderHpSide($('hp-b'), $('hp-num-b'), state.hpB);
  const combo = $('combo');
  // 答對打斷對手連擊、答錯歸零自己連擊，兩者互斥，共用同一枚印章
  const rivalStreak = state.comboA === 0 && state.comboB >= 2;
  combo.textContent = rivalStreak ? `對手連擊 ${state.comboB}` : `連對 ${state.comboA}`;
  combo.hidden = state.comboA < 2 && !rivalStreak; // 連對 0/1 不佔版面
  combo.classList.toggle('is-rival', rivalStreak);
  combo.classList.toggle('is-hot', state.comboA >= 3 || state.comboB >= 3);
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
  } catch (err) {
    console.error('[字字珠璣] 題庫載入失敗', err);
    showLoadError('practice');
    return;
  }
  if (!bank.length) return;
  const mySession = enterQuiz('practice');

  const ids = shuffle(bank.map((e) => e.id)); // 洗牌，避免近似成語同組連續出現
  const state = createLeitnerState(ids);
  const byId = new Map(bank.map((e) => [e.id, e]));
  let lastId = null;

  function nextRound() {
    // 排除剛答過的那題再選，避免它是唯一低盒題時立刻重複
    const pool = ids.length > 1 ? ids.filter((x) => x !== lastId) : ids;
    const id = nextQuestionId(state, pool);
    const entry = byId.get(id);
    renderQuestion(entry);
    bindAnswer(entry, mySession, (correct) => {
      recordAnswer(state, id, correct);
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
  } catch (err) {
    console.error('[字字珠璣] 題庫載入失敗', err);
    showLoadError('battle');
    return;
  }
  if (!bank.length) return;
  const mySession = enterQuiz('battle');

  let state = createBattleState();
  renderBattleHud(state);
  const queue = shuffle(bank);
  let idx = 0;

  function showResult() {
    // 題目耗盡而雙方未倒時，以剩餘血量判定；同血平手
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
  }

  function nextRound() {
    if (isBattleOver(state) || idx >= queue.length) {
      showResult();
      return;
    }
    const entry = queue[idx++];
    renderQuestion(entry);
    bindAnswer(entry, mySession, (correct) => {
      state = applyAnswer(state, 'A', correct);
      if (correct) {
        state = applyAnswer(state, 'B', false); // 答對同時打斷對手連擊
      } else {
        state = applyAnswer(state, 'B', true); // 答錯換對手出招
      }
      renderBattleHud(state);
      nextRound();
    });
  }
  nextRound();
}

$('btn-practice').addEventListener('click', startPractice);
$('btn-battle').addEventListener('click', startBattle);
