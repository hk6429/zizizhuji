// 字靈書院 UI：山水庭園場景渲染與互動。資料規則全在 js/meta/shuyuan-store.js；
// 本檔只管 DOM。sceneHtml/wallHtml 為純函式（node 可單測），缺圖一律 onerror 佔位。

import {
  loadShuyuan, saveShuyuan, seedCelebrated, getShuyuanView,
  DECOR_KINDS, styleIndexOf, setDecorStyle, placeDecoration, resetPlacements,
  PLAQUE_BANK, PLAQUE_TARGETS, PLAQUE_MIN, PLAQUE_MAX, setPlaque,
  COUPLET_BANK, setCouplet,
  pendingCelebrations, markCelebrated, getWallEntries,
} from './meta/shuyuan-store.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const IMG_DIR = 'assets/web/shuyuan';
// 缺圖佔位：換成 emoji span，保住版面尺寸（vocab-duel town.js 已驗證手法）
const fallback = (emoji) =>
  `onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'${emoji}',className:'sy-emoji'}))"`;

const DECOR_EMOJI = { path: '⬜', lantern: '🏮', koi: '🐟', statue: '🗿' };
const COURT_EMOJI = { yin: '🎐', xing: '🌲', chengyu: '🏯' };

// ── 純函式：場景 HTML（node 可單測） ──
export function sceneHtml(view) {
  const g = view.gate;
  const gate =
    `<button class="sy-gate" type="button" data-target="gate" data-stage="${g.stage}"` +
    ` aria-label="山門・${esc(g.rankName)}（點擊題匾額）">` +
    `<img src="${IMG_DIR}/gate-s${g.stage + 1}.jpg" alt="" loading="lazy" ${fallback('⛩️')}>` +
    `<span class="sy-plaque">${esc(view.plaques.gate)}</span>` +
    `<span class="sy-gate-rank">${esc(g.rankName)}（第 ${g.stage + 1}／${g.total} 階）</span>` +
    `</button>`;

  const couplet = view.couplet
    ? `<span class="sy-couplet sy-couplet--up">${esc(view.couplet.up)}</span>` +
      `<span class="sy-couplet sy-couplet--down">${esc(view.couplet.down)}</span>`
    : '';

  const courts = view.courtyards.map((c) =>
    `<button class="sy-court sy-court--${c.id}" type="button" data-target="${c.id}" data-tier="${c.tier}"` +
    ` aria-label="${esc(c.name)}・${esc(c.tierName)}・${esc(c.zoneName)}進度 ${c.pct}%（點擊題匾額）">` +
    `<img src="${IMG_DIR}/court-${c.id}-t${c.tier + 1}.jpg" alt="" loading="lazy" ${fallback(COURT_EMOJI[c.id])}>` +
    `<span class="sy-plaque sy-plaque--small">${esc(view.plaques[c.id])}</span>` +
    `<span class="sy-court-meta">${esc(c.tierName)}・${c.pct}%</span>` +
    `</button>`,
  ).join('');

  const decors = view.decorations.map((d) =>
    `<div class="sy-decor sy-decor--${d.kind}" data-decor="${d.id}" style="left:${d.x}%;top:${d.y}%"` +
    ` role="button" tabindex="0" aria-label="${esc(d.name)}・${esc(d.styleName)}（可拖曳，點擊換樣式）">` +
    `<img src="${IMG_DIR}/decor-${d.kind}-${d.styleIdx}.png" alt="" loading="lazy" draggable="false" ${fallback(DECOR_EMOJI[d.kind])}>` +
    `</div>`,
  ).join('');

  return `<div class="sy-bg"><img src="${IMG_DIR}/bg-garden.jpg" alt="" loading="lazy" ${fallback('🏞️')}></div>` +
    couplet + gate + courts + decors;
}

// ── 純函式：樣式選單／題匾工作檯（node 可單測） ──
export function styleOptionsHtml(kind, currentIdx) {
  const def = DECOR_KINDS[kind];
  return def.styles.map((name, i) =>
    `<button type="button" class="sy-style-opt${i === currentIdx ? ' is-active' : ''}" data-style="${i}">` +
    `<img src="${IMG_DIR}/decor-${kind}-${i}.png" alt="" loading="lazy" ${fallback(DECOR_EMOJI[kind])}>` +
    `<span>${esc(name)}</span></button>`,
  ).join('');
}

export function plaqueComposerHtml(targetId, currentText) {
  const chars = PLAQUE_BANK.map((c) =>
    `<button type="button" class="sy-char" data-char="${c.id}">${esc(c.ch)}</button>`,
  ).join('');
  const couplets = targetId === 'gate'
    ? `<h3 class="sy-sub">門前對聯</h3><div class="sy-couplet-list">` +
      `<button type="button" class="sy-couplet-opt" data-couplet="">不掛對聯</button>` +
      COUPLET_BANK.map((c) =>
        `<button type="button" class="sy-couplet-opt" data-couplet="${c.id}">${esc(c.up)}／${esc(c.down)}</button>`,
      ).join('') + `</div>`
    : '';
  return `<p class="sy-preview">目前：<b id="sy-plaque-preview">${esc(currentText)}</b>` +
    `<button type="button" id="sy-plaque-clear" class="overlay-ghost-btn">清空重選</button></p>` +
    `<p class="shuyuan-hint">從下方選 ${PLAQUE_MIN}–${PLAQUE_MAX} 個字，組成你的匾額（不開放自由輸入）。</p>` +
    `<div class="sy-char-bank">${chars}</div>${couplets}`;
}

// ── DOM 接線 ──
let getMeta = () => null;
let getTotals = () => null;
let state = null;

function view() {
  return getShuyuanView(getMeta(), state, getTotals());
}

function renderScene() {
  $('shuyuan-scene').innerHTML = sceneHtml(view());
}

function open() {
  const meta = getMeta();
  if (!meta || !getTotals()) return; // 機制層未就緒（離線）就不開，跟其他入口同行為
  state = loadShuyuan();
  if (!state.seeded) { seedCelebrated(meta, state); saveShuyuan(state); }
  renderScene();
  openOverlay($('shuyuan-overlay'), close);
}

function close() { closeOverlay($('shuyuan-overlay')); }

// ── 拖曳擺放：pointer 事件，放開才存檔（局部更新，不整場重繪） ──
function bindDrag(scene) {
  let drag = null; // { el, id, moved }
  scene.addEventListener('pointerdown', (ev) => {
    const el = ev.target.closest('.sy-decor');
    if (!el) return;
    drag = { el, id: el.dataset.decor, moved: false };
    el.classList.add('is-dragging');
    el.setPointerCapture(ev.pointerId);
  });
  scene.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    drag.moved = true;
    const r = scene.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * 100;
    const y = ((ev.clientY - r.top) / r.height) * 100;
    drag.el.style.left = `${Math.max(2, Math.min(98, x))}%`;
    drag.el.style.top = `${Math.max(2, Math.min(98, y))}%`;
  });
  scene.addEventListener('pointerup', (ev) => {
    if (!drag) return;
    const { el, id, moved } = drag;
    el.classList.remove('is-dragging');
    drag = null;
    if (moved) {
      const r = scene.getBoundingClientRect();
      const x = ((ev.clientX - r.left) / r.width) * 100;
      const y = ((ev.clientY - r.top) / r.height) * 100;
      if (placeDecoration(state, id, x, y).ok) saveShuyuan(state);
    } else {
      openStylePicker(id.slice(0, id.lastIndexOf('-'))); // 原地點擊＝換樣式
    }
  });
  // 鍵盤操作：ARIA 承諾「點擊換樣式」，Enter／Space 要能達成同樣效果
  scene.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
    const el = ev.target.closest('.sy-decor');
    if (!el) return;
    if (ev.key !== 'Enter') ev.preventDefault(); // Space 預設會滾動頁面
    openStylePicker(el.dataset.decor.slice(0, el.dataset.decor.lastIndexOf('-')));
  });
}

function openStylePicker(kind) {
  const list = $('shuyuan-style-list');
  list.innerHTML = styleOptionsHtml(kind, styleIndexOf(state, kind));
  list.onclick = (ev) => {
    const btn = ev.target.closest('[data-style]');
    if (!btn) return;
    if (setDecorStyle(state, kind, Number(btn.dataset.style)).ok) {
      saveShuyuan(state);
      renderScene();
      list.innerHTML = styleOptionsHtml(kind, styleIndexOf(state, kind));
    }
  };
  openOverlay($('shuyuan-style-overlay'), () => closeOverlay($('shuyuan-style-overlay')));
}

let plaqueTarget = null;
let plaquePick = [];
function openPlaqueComposer(targetId) {
  plaqueTarget = targetId;
  plaquePick = [];
  const body = $('shuyuan-plaque-body');
  body.innerHTML = plaqueComposerHtml(targetId, getShuyuanView(getMeta(), state, getTotals()).plaques[targetId]);
  body.onclick = (ev) => {
    const charBtn = ev.target.closest('[data-char]');
    const coupletBtn = ev.target.closest('[data-couplet]');
    if (charBtn && plaquePick.length < PLAQUE_MAX) {
      plaquePick.push(charBtn.dataset.char);
      $('sy-plaque-preview').textContent = plaquePick
        .map((id) => PLAQUE_BANK.find((c) => c.id === id).ch).join('');
    } else if (ev.target.id === 'sy-plaque-clear') {
      plaquePick = [];
      $('sy-plaque-preview').textContent = '（重新選字）';
    } else if (coupletBtn) {
      if (setCouplet(state, coupletBtn.dataset.couplet || null).ok) { saveShuyuan(state); renderScene(); }
    }
  };
  openOverlay($('shuyuan-plaque-overlay'), () => closeOverlay($('shuyuan-plaque-overlay')));
}

export function initShuyuanUI(opts) {
  getMeta = opts.getMeta;
  getTotals = opts.getTotals;
  $('btn-shuyuan').addEventListener('click', open);
  $('shuyuan-close').addEventListener('click', close);
  bindDrag($('shuyuan-scene'));
  $('shuyuan-scene').addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-target]');
    if (t && PLAQUE_TARGETS.includes(t.dataset.target)) openPlaqueComposer(t.dataset.target);
  });
  $('shuyuan-style-close').addEventListener('click', () => closeOverlay($('shuyuan-style-overlay')));
  $('shuyuan-plaque-close').addEventListener('click', () => closeOverlay($('shuyuan-plaque-overlay')));
  $('shuyuan-plaque-save').addEventListener('click', () => {
    if (plaquePick.length >= PLAQUE_MIN && setPlaque(state, plaqueTarget, plaquePick).ok) {
      saveShuyuan(state);
      renderScene();
      closeOverlay($('shuyuan-plaque-overlay'));
    }
  });
  $('shuyuan-reset').addEventListener('click', () => {
    // 白帽：二次確認＋明講不會失去任何東西
    if (confirm('把所有裝飾放回預設位置嗎？裝飾不會消失，只是回到原位。')) {
      resetPlacements(state);
      saveShuyuan(state);
      renderScene();
    }
  });
}
