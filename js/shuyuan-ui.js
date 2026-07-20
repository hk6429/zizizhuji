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

export function initShuyuanUI(opts) {
  getMeta = opts.getMeta;
  getTotals = opts.getTotals;
  $('btn-shuyuan').addEventListener('click', open);
  $('shuyuan-close').addEventListener('click', close);
}
