// zizizhuji/js/app.js
import { BANK_SOURCES, fetchBank, loadBank, getLevel, setLevel } from './bank.js';
import { nextQuestionId } from './leitner.js';
import * as kernel from './meta/kernel.js';
import {
  ensureMeta, getCtx, getToday, refreshWidgets, bindDailyBox,
  renderEvents, renderSummary, syncPets,
  beginBattle, battleOver, applyEliminate, hideMolingBubble, showMolingLine,
  updateQuizHud, getLanternProgress,
} from './integration.js';
import { initPetUI } from './pet-ui.js';
import { initFusionUI } from './fusion-ui.js';
import { initSelfStudy } from './selfstudy-ui.js';
import { initScoreGame } from './scoregame-ui.js';
import { initAchievementsUI } from './achievements-ui.js';
import { initPearlsUI } from './pearls-ui.js';
import { initMarketUI } from './market-ui.js';
import { initShuyuanUI } from './shuyuan-ui.js';
import { initRtBattleUI } from './rtbattle-ui.js';
import { initTianxia } from './tianxia-ui.js';
import { initSaveSyncUI } from './save-sync-ui.js';
import { initReportUI, attachReportButton } from './report.js';
import { saveMeta } from './meta/store.js';
import { checkWelcomeBack } from './meta/welcome-back.js';
import { shuffle } from './shuffle.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';
import { initNoDamagePrompt, maybeOfferNoDamage } from './nodamage-prompt.js';
import { initTermsHelp } from './terms-intro.js';
import { playCorrect, playWrong, playCombo, isSoundOn, setSoundOn } from './sound.js';
import { isDailyLimitReached, bypassLimitOnce, hasDailyPin, checkDailyPin } from './daily-limit.js';

// 每連對 3 題加碼一次連擊音效（呼應連對獎勵遞增，見 js/meta/kernel.js 的 XP_COMBO_BONUS）
function maybePlayCombo(ctx) {
  const combo = ctx.session.combo;
  if (combo > 0 && combo % 3 === 0) playCombo();
}

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
// 音效開關：預設開啟，Web Audio 合成短音（見 js/sound.js），不載外部音檔
const soundToggle = document.getElementById('toggle-sound');
if (soundToggle) {
  soundToggle.checked = isSoundOn();
  soundToggle.addEventListener('change', () => setSoundOn(soundToggle.checked));
}
// 首次低血/斷燈時的一次性提示：學生同意就當場開啟無傷模式並同步勾選狀態
initNoDamagePrompt(() => {
  noDamageMode = true;
  if (ndToggle) ndToggle.checked = true;
});

const $ = (id) => document.getElementById(id);

/* ---------- 學制切換 ---------- */
async function renderBankCounts() {
  const [ziyin, chengyu] = await Promise.all(
    BANK_SOURCES[getLevel()].mixed.map((src) => fetchBank(src.path, src.kind)),
  );
  const matchDiff = (q) => currentDifficulty === 'all' || q.difficulty === currentDifficulty;
  const ziyinCount = ziyin.filter(matchDiff).length;
  const chengyuCount = chengyu.filter(matchDiff).length;
  $('bank-count-ziyin').textContent = `${ziyinCount} 題`;
  $('bank-count-chengyu').textContent = `${chengyuCount} 題`;
  $('bank-count-mixed').textContent = `${ziyinCount + chengyuCount} 題`;
}

const AVATAR_SRC = {
  國小: { player: 'assets/web/char-player.jpg', rival: 'assets/web/char-rival.jpg' },
  國中: { player: 'assets/web/char-player-junior.jpg', rival: 'assets/web/char-rival-junior.jpg' },
};

function renderAvatars() {
  const src = AVATAR_SRC[getLevel()];
  for (const id of ['avatar-player', 'hp-avatar-player']) $(id).src = src.player;
  for (const id of ['avatar-rival', 'hp-avatar-rival']) $(id).src = src.rival;
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
renderAvatars();

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
    renderBankCounts();
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
  // 練習模式顯示守燈／回合進度 HUD；對戰有自己的血條 HUD 就不疊
  const hud = $('quiz-hud');
  hud.hidden = mode !== 'practice';
  if (mode === 'practice') updateQuizHud();
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

// 家長每日練習題數上限：達標時攔下一題，改顯示提示卡（軟性提醒，可「再練一下下」解除當次）
// 家長若設了通行碼，「再練一下下」須先輸入正確碼才放行。
let dailyLimitContinueCb = null;
function showDailyLimitOverlay(onContinue) {
  dailyLimitContinueCb = onContinue;
  const pinBox = $('daily-limit-pinbox');
  const pinInput = $('daily-limit-pin');
  const pinMsg = $('daily-limit-pin-msg');
  const pinOn = hasDailyPin();
  pinBox.hidden = !pinOn;
  if (pinOn) { pinInput.value = ''; pinMsg.textContent = ''; }
  openOverlay($('daily-limit-overlay'), () => closeOverlay($('daily-limit-overlay')));
}
$('daily-limit-continue').addEventListener('click', () => {
  if (hasDailyPin() && !checkDailyPin($('daily-limit-pin').value)) {
    $('daily-limit-pin-msg').textContent = '通行碼不對，請找家長協助。';
    return;
  }
  bypassLimitOnce();
  closeOverlay($('daily-limit-overlay'));
  const cb = dailyLimitContinueCb;
  dailyLimitContinueCb = null;
  if (cb) cb();
});
$('daily-limit-home').addEventListener('click', () => {
  closeOverlay($('daily-limit-overlay'));
  dailyLimitContinueCb = null;
  backHome();
});

// 練習每 10 題的輕量里程碑卡：不結算、不重置 session，只給進度回饋＋回訪守燈提示
let milestoneContinueCb = null;
function showMilestoneOverlay(onContinue) {
  const ctx = getCtx();
  if (!ctx) { if (onContinue) onContinue(); return; }
  milestoneContinueCb = onContinue;
  const s = ctx.session;
  const acc = s.total ? Math.round((s.correct / s.total) * 100) : 0;
  $('milestone-msg').textContent = `本回合已練 ${s.total} 題，答對 ${s.correct} 題（${acc}%）！`;
  const lp = getLanternProgress();
  $('milestone-lantern').textContent = lp.litToday
    ? `🪔 今天的長明燈已經點亮，守燈 ${lp.streak} 天，繼續保持！`
    : `🪔 今日守燈 ${lp.todayCorrect}/${lp.goal}，再答對 ${lp.remaining} 題就能點亮長明燈！`;
  openOverlay($('milestone-overlay'), () => closeOverlay($('milestone-overlay')));
}
$('milestone-continue').addEventListener('click', () => {
  closeOverlay($('milestone-overlay'));
  const cb = milestoneContinueCb;
  milestoneContinueCb = null;
  if (cb) cb();
});
$('milestone-finish').addEventListener('click', () => {
  closeOverlay($('milestone-overlay'));
  milestoneContinueCb = null;
  backHome(); // 走既有收卷結算 → 戰報卡（含分享圖卡按鈕）
});

/* ---------- 出題與回饋 ---------- */
// 選項本來就用甲乙丙丁編號（css counter(opt, cjk-heavenly-stem)），數字鍵 1-4 快捷鍵要對得上，
// 靠 aria-label 把「甲」與「快捷鍵 1」講清楚，畫面上不再疊一個衝突的「1.」數字
const STEMS = ['甲', '乙', '丙', '丁'];
function renderQuestion(entry) {
  $('question-text').textContent = entry.question;
  const optionsEl = $('options');
  optionsEl.innerHTML = '';
  shuffle(entry.options).forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opt;
    btn.dataset.value = opt;
    btn.setAttribute('aria-keyshortcuts', String(i + 1));
    btn.setAttribute('aria-label', `${STEMS[i] || i + 1}、${opt}（快捷鍵 ${i + 1}）`);
    optionsEl.appendChild(btn);
  });
  const feedbackEl = $('answer-feedback');
  if (feedbackEl) { feedbackEl.hidden = true; feedbackEl.textContent = ''; }
  const nextBtn = $('answer-next-btn');
  if (nextBtn) { nextBtn.hidden = true; nextBtn.onclick = null; }
  attachReportButton(entry);
}

// 數字鍵 1-4 對應選項順位；空白鍵＝練習模式手動下一題；輸入框有焦點時不攔截，避免打斷回報/存檔代碼輸入
const OPTIONS_CONTAINER_IDS = ['options', 'sg-options'];
document.addEventListener('keydown', (ev) => {
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

  if (ev.key === ' ') {
    const nextBtn = $('answer-next-btn');
    if (nextBtn && !nextBtn.hidden) {
      nextBtn.click();
      ev.preventDefault();
    }
    return;
  }

  const key = ev.key;
  if (key < '1' || key > '4') return;
  const idx = Number(key) - 1;
  for (const id of OPTIONS_CONTAINER_IDS) {
    const container = document.getElementById(id);
    if (!container || container.offsetParent === null) continue;
    const btn = container.children[idx];
    if (btn && !btn.disabled) {
      btn.click();
      ev.preventDefault();
    }
    break;
  }
});

// 部分題庫的 note 欄位只是資料來源標註（非逐選項辨析），不該當解說顯示給使用者：
// chengyu-elementary 全數是「XX年國中基測/會考國文第X題」考題出處；
// chengyu-junior 的 def-pick 題型全數是「教育部重編國語辭典＋g0v moedict成語詞頭錨定【T?】」錨定標籤。
const CITATION_ONLY_NOTE_RES = [
  /^\d+年國中(基測|會考)國文第\d+題$/,
  /^教育部重編國語辭典＋g0v moedict成語詞頭錨定【T\d+】$/,
];
function isCitationOnlyNote(note) {
  return CITATION_ONLY_NOTE_RES.some((re) => re.test(note));
}

function bindAnswer(entry, mySession, onDone, opts = {}) {
  const optionsEl = $('options');
  optionsEl.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn || !btn.dataset.value || btn.disabled) return;
    optionsEl.onclick = null;
    const correct = btn.dataset.value === entry.answer;
    const buttons = optionsEl.querySelectorAll('button');
    buttons.forEach((b) => { b.disabled = true; });
    btn.classList.add(correct ? 'correct' : 'wrong');
    if (correct) playCorrect(); else playWrong();
    if (!correct) {
      for (const b of buttons) {
        if (b.dataset.value === entry.answer) { b.classList.add('reveal'); break; }
      }
    }
    const feedbackEl = $('answer-feedback');
    if (feedbackEl) {
      const idx = Array.isArray(entry.explain) ? entry.options.indexOf(btn.dataset.value) : -1;
      let explainText = idx >= 0 ? entry.explain[idx] : '';
      // 成語題（尤其「何者使用正確」這類 usage-judge/usage-wrong）沒有逐選項 explain 陣列，
      // 但 note 欄位本身就是完整的辨析內容（各選項誤用原因），只是原本沒被讀出來顯示。
      if (!explainText && entry.note && !isCitationOnlyNote(entry.note)) {
        explainText = entry.note;
      }
      feedbackEl.textContent = correct
        ? `答對了！${explainText}`
        : `答錯了，正解是「${entry.answer}」。${explainText}`;
      feedbackEl.hidden = false;
    }
    if (opts.manual) {
      // 練習模式：老師反饋解說一閃即逝來不及看，改手動點「下一題」才前進
      const nextBtn = $('answer-next-btn');
      if (nextBtn) {
        nextBtn.hidden = false;
        nextBtn.onclick = () => {
          nextBtn.hidden = true;
          nextBtn.onclick = null;
          if (mySession !== session) return; // 已收卷或重新開局
          onDone(correct);
        };
      } else {
        onDone(correct); // 找不到按鈕的防呆退回自動前進
      }
      return;
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
  // 玩家自己第一次進入低血狀態時，跳一次性提示卡問要不要開無傷模式
  if (!noDamageMode && state.hpA <= maxHpA * 0.3) maybeOfferNoDamage();
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
    if (isDailyLimitReached(ctx.meta)) { showDailyLimitOverlay(nextRound); return; }
    // 排除剛答過的那題再選，避免它是唯一低盒題時立刻重複
    const pool = ids.length > 1 ? ids.filter((x) => x !== lastId) : ids;
    const id = nextQuestionId(state, pool, byId);
    const entry = byId.get(id);
    renderQuestion(entry);
    bindAnswer(entry, mySession, (correct) => {
      // kernel 內部已呼叫 leitner.recordAnswer ＋持久化，此處不可再 recordAnswer
      const { events } = kernel.onPracticeAnswer(ctx, id, correct);
      renderEvents(events);
      maybePlayCombo(ctx);
      syncPets(); // 精通題數可能剛跨過解鎖門檻
      updateQuizHud(); // 守燈／回合進度即時更新
      lastId = id;
      // 每 10 題輕量里程碑：成就閉環＋回訪守燈提示，順勢可收卷看戰報並分享
      if (ctx.session.total > 0 && ctx.session.total % 10 === 0) {
        showMilestoneOverlay(nextRound);
      } else {
        nextRound();
      }
    }, { manual: true });
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
  let pendingChallenge = null; // 字妖突襲：下一題轉為挑戰題（答對回血、答錯無懲罰）

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
    if (isDailyLimitReached(ctx.meta)) { showDailyLimitOverlay(nextRound); return; }
    if (battleOver(state) || idx >= queue.length) {
      endBattle();
      return;
    }
    const entry = queue[idx++];
    renderQuestion(entry);

    // 字妖突襲挑戰題：獨立加賽一題，答對回血、答錯無懲罰（雙方都不出招）
    if (pendingChallenge) {
      const heal = pendingChallenge.healOnWin || 10;
      pendingChallenge = null;
      $('mode-tag').textContent = '字妖挑戰';
      bindAnswer(entry, mySession, (correct) => {
        $('mode-tag').textContent = '對戰';
        if (correct) {
          state = { ...state, hpA: Math.min(maxHpA, state.hpA + heal) };
          battleState = state;
          renderBattleHud(state, maxHpA, maxHpB);
          showMolingLine(`字妖敗退！你回復了 ${heal} 點 HP`);
        } else {
          showMolingLine('字妖溜走了，沒有損失，繼續！');
        }
        nextRound();
      });
      return;
    }

    applyEliminate($('options'), entry.answer); // 明目日/奇遇：劃掉錯誤選項
    bindAnswer(entry, mySession, (correct) => {
      // kernel 經 battle-adapter 呼叫 applyAnswer 並疊加法寶/護符/奇遇，不可再自己 applyAnswer
      const rA = kernel.onBattleAnswer(ctx, state, 'A', correct, entry.id);
      renderEvents(rA.events);
      maybePlayCombo(ctx);
      for (const e of rA.events) {
        const p = e.payload || {};
        if (e.type === 'encounter' && p.effect && p.effect.type === 'challenge') pendingChallenge = p.effect;
      }
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
// 首屏大 CTA：用目前預設（國小・字音字形・全部難度）直接開練，砍掉新手的選擇成本
$('btn-quickstart').addEventListener('click', startPractice);

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
initTermsHelp();
const ensureCtx = async () => { await initMetaLayer(); return getCtx(); };
bindDailyBox();
initPetUI({ getMeta: () => getCtx()?.meta, onChange: refreshWidgets });
initFusionUI({ getMeta: () => getCtx()?.meta, onChange: refreshWidgets });
initSelfStudy({ loadBank, ensureCtx });
initScoreGame({ loadBank, ensureCtx, onChange: refreshWidgets });
initAchievementsUI({ getMeta: () => getCtx()?.meta });
initTianxia({ getMeta: () => getCtx()?.meta });
initPearlsUI({
  getMeta: () => getCtx()?.meta,
  // 珠面文字要跨學制解析：兩學制的混合題庫全載（fetchBank 有快取，重開不重抓）
  loadEntries: async () => {
    const srcs = Object.values(BANK_SOURCES).flatMap((lv) => lv.mixed);
    const banks = await Promise.all(srcs.map((s) => fetchBank(s.path, s.kind)));
    return new Map(banks.flat().map((e) => [e.id, e]));
  },
  // 進度總覽只看「目前學制」的題庫（國小/國中各自的字音庫、成語庫不混算）
  loadLevelBanks: async () => {
    const [ziyin, chengyu] = await Promise.all([loadBank('ziyin'), loadBank('chengyu')]);
    return { ziyin, chengyu };
  },
});
initMarketUI({ getMeta: () => getCtx()?.meta, saveMeta });
initShuyuanUI({
  getMeta: () => getCtx()?.meta,
  getTotals: () => getCtx()?.totals,
});
initRtBattleUI();
initSaveSyncUI({
  getMeta: () => getCtx()?.meta,
  onLoaded: (data) => { saveMeta(data); location.reload(); },
});
initReportUI();
initMetaLayer().then(() => {
  maybeShowWelcomeBack();
  // 不再進站就自動彈「修行小抄」——改為隨時可點 meta-bar 的「？」查看，讓新手先玩再讀。
});
