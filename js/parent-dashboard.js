// 家長儀表板：唯讀報表頁，獨立於主遊戲 bootstrap 之外。
// 全程只呼叫 pullSave（GET），絕不呼叫 saveMeta——不覆蓋任何本機進度，跟
// save-sync-ui.js 那個「覆蓋式」消費端是完全分開的兩條路。

import { pullSave } from './save-sync.js';
import { getWeaknessSummary } from './meta/weakness.js';
import { getMostWrong } from './meta/collection.js';

const $ = (id) => document.getElementById(id);

const BANK_FILES = [
  { path: 'data/ziyin-zixing-elementary.json', kind: 'ziyin' },
  { path: 'data/ziyin-zixing-junior.json', kind: 'ziyin' },
  { path: 'data/chengyu-elementary.json', kind: 'chengyu' },
  { path: 'data/chengyu-junior.json', kind: 'chengyu' },
];

let bankCache = null;

async function loadBanks() {
  if (bankCache) return bankCache;
  const lists = await Promise.all(
    BANK_FILES.map(async (f) => {
      try {
        const r = await fetch(f.path);
        if (!r.ok) return [];
        return await r.json();
      } catch { return []; }
    }),
  );
  bankCache = {
    ziyin: [...lists[0], ...lists[1]],
    chengyu: [...lists[2], ...lists[3]],
  };
  return bankCache;
}

function el(tag, cls, txt) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (txt != null) n.textContent = txt;
  return n;
}

function renderStats(meta) {
  const totalAnswered = meta.xp?.totalAnswered || 0;
  const totalCorrect = meta.xp?.totalCorrect || 0;
  const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
  $('pd-total-answered').textContent = totalAnswered;
  $('pd-total-correct').textContent = totalCorrect;
  $('pd-accuracy').textContent = `${accuracy}%`;
  $('pd-streak').textContent = meta.daily?.streak || 0;
}

function renderWeakness(meta) {
  const host = $('pd-weak-list');
  host.innerHTML = '';
  const summary = getWeaknessSummary(meta);
  if (!summary.length) {
    host.appendChild(el('p', 'pd-empty', '還沒有足夠的答題紀錄。'));
    return;
  }
  for (const r of summary) {
    const row = el('div', 'pd-weak-row');
    const pct = Math.round(r.accuracy * 100);
    row.appendChild(el('span', 'pd-weak-label', r.type));
    const bar = el('div', 'pd-weak-bar');
    const fill = el('span');
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    row.appendChild(bar);
    row.appendChild(el('span', 'pd-weak-pct', `${pct}%`));
    host.appendChild(row);
  }
}

function renderWrongList(hostId, meta, bank) {
  const host = $(hostId);
  host.innerHTML = '';
  const rows = getMostWrong(meta, bank, 10);
  if (!rows.length) {
    host.appendChild(el('li', 'pd-empty', '目前沒有常錯的題目，表現很穩定！'));
    return;
  }
  for (const r of rows) {
    const li = el('li');
    li.appendChild(el('span', 'pd-wrong-q', r.entry.question || r.id));
    li.appendChild(el('span', 'pd-wrong-n', `錯 ${r.wrong} 次`));
    host.appendChild(li);
  }
}

function renderTrend(meta) {
  const host = $('pd-trend');
  host.innerHTML = '';
  const trend = Array.isArray(meta.trend) ? meta.trend : [];
  if (!trend.length) {
    host.appendChild(el('p', 'pd-empty', '還沒有跨日紀錄，累積幾天後就會顯示趨勢。'));
    return;
  }
  const max = Math.max(1, ...trend.map((d) => d.answered || 0));
  for (const d of trend) {
    const bar = el('div', 'pd-trend-bar');
    const h = Math.round(((d.answered || 0) / max) * 100);
    bar.style.height = `${Math.max(2, h)}%`;
    bar.dataset.answered = String(d.answered || 0);
    bar.title = `${d.date}：答題 ${d.answered || 0} 題，答對 ${d.correct || 0} 題`;
    host.appendChild(bar);
  }
}

function setStatus(text, isErr) {
  const s = $('pd-status');
  s.textContent = text;
  s.classList.toggle('pd-status--err', !!isErr);
}

async function lookup() {
  const code = $('pd-code').value.trim().toUpperCase();
  if (!code) return;
  const btn = $('pd-go');
  btn.disabled = true;
  btn.textContent = '查詢中…';
  setStatus('查詢中…');
  $('pd-report').hidden = true;

  const r = await pullSave(code);
  btn.disabled = false;
  btn.textContent = '查詢';
  if (!r.ok || !r.data) {
    setStatus('找不到這組代碼的存檔，請確認代碼是否正確', true);
    return;
  }
  const meta = r.data;
  setStatus('查詢成功（唯讀，不會影響孩子的進度）');

  const bank = await loadBanks();
  renderStats(meta);
  renderWeakness(meta);
  renderWrongList('pd-wrong-ziyin', meta, bank.ziyin);
  renderWrongList('pd-wrong-chengyu', meta, bank.chengyu);
  renderTrend(meta);
  $('pd-report').hidden = false;
}

$('pd-go').addEventListener('click', lookup);
$('pd-code').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') lookup(); });
