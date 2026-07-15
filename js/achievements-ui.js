// 成就總覽頁 UI：純讀取 js/meta/achievements.js 的 getAchievementsOverview，無新增持久狀態。

import { getAchievementsOverview } from './meta/achievements.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const $ = (id) => document.getElementById(id);

let getMeta = () => null;

export function initAchievementsUI(opts) {
  getMeta = opts.getMeta;
  $('btn-achievements').addEventListener('click', open);
  $('ach-close').addEventListener('click', close);
}

function open() {
  if (!getMeta()) return;
  render();
  openOverlay($('ach-overlay'), close);
}

function close() { closeOverlay($('ach-overlay')); }

function render() {
  const meta = getMeta();
  const grid = $('ach-grid');
  grid.innerHTML = '';
  for (const a of getAchievementsOverview(meta)) {
    const item = document.createElement('div');
    item.className = `ach-item${a.unlocked ? '' : ' is-locked'}`;

    const icon = document.createElement('span');
    icon.className = 'ach-item__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = a.unlocked ? '✓' : '？';

    const body = document.createElement('div');
    body.className = 'ach-item__body';
    const pct = a.progress ? Math.min(100, Math.round((a.progress.current / a.progress.target) * 100)) : (a.unlocked ? 100 : 0);
    body.innerHTML =
      `<span class="ach-item__name">${a.name}</span>` +
      `<span class="ach-item__desc">${a.desc}</span>` +
      (a.progress && !a.unlocked
        ? `<span class="ach-item__track"><span class="ach-item__track-fill" style="width:${pct}%"></span></span>`
        : '');

    const pearls = document.createElement('span');
    pearls.className = 'ach-item__pearls';
    pearls.textContent = `${a.pearls} 珠`;

    item.append(icon, body, pearls);
    grid.appendChild(item);
  }
}
