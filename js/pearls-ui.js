// 字珠寶殿：已煉成字珠的收藏總覽頁。純讀取 js/meta/collection.js 的 getCollection，無新增持久狀態。
// 珠面文字由題庫解析：字音題取「」內目標字、字形/成語題取答案。

import { getCollection, getMasteryStats, GRADES } from './meta/collection.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const $ = (id) => document.getElementById(id);

let getMeta = () => null;
let loadEntries = async () => new Map(); // id -> bank entry
let loadLevelBanks = async () => ({ ziyin: [], chengyu: [] }); // 目前學制的字音／成語庫，算進度用

export function initPearlsUI(opts) {
  getMeta = opts.getMeta;
  loadEntries = opts.loadEntries;
  loadLevelBanks = opts.loadLevelBanks || loadLevelBanks;
  $('btn-pearls').addEventListener('click', open);
  $('pearls-close').addEventListener('click', close);
}

async function open() {
  if (!getMeta()) return;
  await render();
  openOverlay($('pearls-overlay'), close);
}

function close() { closeOverlay($('pearls-overlay')); }

export function labelOf(entry) {
  if (!entry) return null;
  if (entry.type === '字音') {
    const m = entry.question.match(/「[^」]+」的「([^」]+)」/);
    if (m) return m[1];
  }
  return entry.anchor?.[0] ?? entry.answer;
}

function renderStatLine(label, stats) {
  const pct = stats.total > 0 ? Math.round((stats.known / stats.total) * 100) : 0;
  const row = document.createElement('div');
  row.className = 'pearls-stat-row';
  row.innerHTML = `
    <span class="pearls-stat-label">${label}</span>
    <span class="pearls-stat-nums">已認識 ${stats.known}／共 ${stats.total}（還剩 ${stats.remaining}，精熟 ${stats.mastered}）</span>
    <span class="pearls-stat-bar"><span class="pearls-stat-bar__fill" style="width:${pct}%"></span></span>
  `;
  return row;
}

async function render() {
  const meta = getMeta();
  const col = getCollection(meta);
  const entries = await loadEntries();

  const stats = $('pearls-stats');
  if (stats) {
    stats.innerHTML = '';
    const { ziyin, chengyu } = await loadLevelBanks();
    stats.appendChild(renderStatLine('字音字形', getMasteryStats(meta, ziyin)));
    stats.appendChild(renderStatLine('成語', getMasteryStats(meta, chengyu)));
  }

  const counts = $('pearls-counts');
  counts.innerHTML = '';
  GRADES.forEach((name, g) => {
    const chip = document.createElement('span');
    chip.className = `pearls-count pearls-count--g${g}`;
    chip.textContent = `${name} ×${col.counts[g]}`;
    counts.appendChild(chip);
  });
  if (col.dustyCount > 0) {
    const dusty = document.createElement('span');
    dusty.className = 'pearls-count pearls-count--dusty';
    dusty.textContent = `蒙塵 ×${col.dustyCount}`;
    counts.appendChild(dusty);
  }

  const grid = $('pearls-grid');
  grid.innerHTML = '';
  const sorted = [...col.earned].sort((a, b) => b.grade - a.grade || a.id.localeCompare(b.id));
  for (const p of sorted) {
    const label = labelOf(entries.get(p.id));
    if (!label) continue; // 題庫改版後找不到的珠不顯示
    const chip = document.createElement('span');
    chip.className = `pearl-chip pearl-chip--g${p.grade}${p.dusty ? ' is-dusty' : ''}`;
    chip.textContent = label;
    chip.title = `${p.gradeName}${p.dusty ? '（蒙塵，再答對就能擦亮）' : ''}`;
    grid.appendChild(chip);
  }
  $('pearls-empty').hidden = grid.children.length > 0;
}
