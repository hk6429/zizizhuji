// zizizhuji/js/app.js
import { loadQuizBank } from './quiz-loader.js';
import { createLeitnerState, recordAnswer, nextQuestionId } from './leitner.js';
import { createBattleState, applyAnswer, isBattleOver } from './battle.js';

async function fetchBank(path, kind) {
  const res = await fetch(path);
  const raw = await res.json();
  const { usable, rejected } = loadQuizBank(raw, kind);
  if (rejected.length) {
    console.warn(`[字字珠璣] ${path} 有 ${rejected.length} 筆題目未通過驗證，已排除`, rejected);
  }
  return usable;
}

function renderQuestion(entry) {
  document.getElementById('quiz-area').hidden = false;
  document.getElementById('question-text').textContent = entry.question;
  const optionsEl = document.getElementById('options');
  optionsEl.innerHTML = '';
  entry.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.textContent = opt;
    btn.dataset.value = opt;
    optionsEl.appendChild(btn);
  });
}

async function startPractice() {
  const bank = await fetchBank('data/ziyin-zixing-elementary.json', 'ziyin');
  if (!bank.length) return;
  const ids = bank.map(e => e.id);
  const state = createLeitnerState(ids);
  const byId = new Map(bank.map(e => [e.id, e]));

  function nextRound() {
    const id = nextQuestionId(state, ids);
    const entry = byId.get(id);
    renderQuestion(entry);
    document.getElementById('options').onclick = (ev) => {
      const value = ev.target.dataset.value;
      if (!value) return;
      recordAnswer(state, id, value === entry.answer);
      nextRound();
    };
  }
  nextRound();
}

async function startBattle() {
  const bank = await fetchBank('data/ziyin-zixing-elementary.json', 'ziyin');
  if (!bank.length) return;
  let state = createBattleState();
  const shuffled = bank.slice().sort(() => Math.random() - 0.5);
  let idx = 0;

  function nextRound() {
    if (isBattleOver(state) || idx >= shuffled.length) return;
    const entry = shuffled[idx++];
    renderQuestion(entry);
    document.getElementById('options').onclick = (ev) => {
      const value = ev.target.dataset.value;
      if (!value) return;
      state = applyAnswer(state, 'A', value === entry.answer);
      nextRound();
    };
  }
  nextRound();
}

document.getElementById('btn-practice').addEventListener('click', startPractice);
document.getElementById('btn-battle').addEventListener('click', startBattle);
