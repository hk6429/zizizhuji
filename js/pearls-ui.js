// 字珠寶殿：已煉成字珠的收藏總覽頁。純讀取 js/meta/collection.js 的 getCollection，無新增持久狀態。
// 珠面文字由題庫解析：字音題取「」內目標字、字形/成語題取答案。

import { getCollection, GRADES } from './meta/collection.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const $ = (id) => document.getElementById(id);

let getMeta = () => null;
let loadEntries = async () => new Map(); // id -> bank entry

export function initPearlsUI(opts) {
  getMeta = opts.getMeta;
  loadEntries = opts.loadEntries;
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

async function render() {
  const meta = getMeta();
  const col = getCollection(meta);
  const entries = await loadEntries();

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
