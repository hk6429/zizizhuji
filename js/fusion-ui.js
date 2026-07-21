// 融合坊 UI：神獸融合（墨晶／隱藏題揭曉／融合執行／被動選擇／稚靈收藏）。
// 資料與規則全走 js/meta/fusion-store.js；本檔只負責渲染與事件，存檔經 saveMeta。
// 白帽硬規則：融合失敗只顯示安慰台詞＋字珠，絕不出現任何損失清單（見 task-9-brief 自我檢查）。

import { saveMeta } from './meta/store.js';
import {
  getEligibility, getCrystalBalance, getRevealState, answerRevealRiddle, getFusionPreview,
  fuse, FUSE_COST, CUB_PASSIVES, chooseCubPassive, setActiveCub, clearActiveCub,
  setCubNickname, buildCubCardData, listCubs, getPairCooldown,
} from './meta/fusion-store.js';
import { getToday } from './integration.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';
import { renderCubCard, exportShareCard } from './fusion-card.js';

const CATEGORIES = ['字音', '成語', '混合'];

const $ = (id) => document.getElementById(id);

// 暱稱是使用者輸入，插進 innerHTML 前先轉義
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

let getMeta = () => null;
let onChange = () => {};

// 一次融合過程中的暫存選擇（選兩隻雙親／揭曉題答案／等待被動選擇），overlay 關閉即清空。
let picked = { category: null, petA: null, petB: null };
let pendingPassiveCubId = null; // 融合成功、尚未選被動的稚靈 id
let revealAnswered = {}; // { [category]: true } 本次開啟已作答過（避免同題連點）

export function initFusionUI(opts) {
  getMeta = opts.getMeta;
  onChange = opts.onChange || (() => {});

  $('btn-fusion').addEventListener('click', open);
  $('fusion-close').addEventListener('click', close);

  for (const tab of document.querySelectorAll('.fusion-tab')) {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  }
}

function open() {
  if (!getMeta()) return;
  picked = { category: null, petA: null, petB: null };
  pendingPassiveCubId = null;
  revealAnswered = {};
  switchTab('forge');
  render();
  openOverlay($('fusion-overlay'), close);
}

function close() { closeOverlay($('fusion-overlay')); }

function switchTab(name) {
  for (const tab of document.querySelectorAll('.fusion-tab')) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  $('fusion-panel-forge').hidden = name !== 'forge';
  $('fusion-panel-cubs').hidden = name !== 'cubs';
  if (name === 'cubs') renderCubs();
}

function render() {
  const meta = getMeta();
  $('fusion-crystal-balance').textContent = getCrystalBalance(meta);
  renderForge();
}

// 資格進度條：把「還差多少」講清楚，讓孩子有「快解鎖了」的期待感，而不是單純被 ❌ 打回票。
function eligibilityBadge(reasons, progress) {
  const pairMark = reasons.pair ? '✅' : '❌';
  const accMark = reasons.accuracy ? '✅' : '❌';

  const pairText = progress.pair.met
    ? '雙親已經備妥'
    : `雙親還差 ${progress.pair.remaining} 級就能出戰`;

  const accPct = Math.round(progress.accuracy.current * 100);
  const accText = progress.accuracy.met
    ? `正確率 ${accPct}%（已達標）`
    : `正確率 ${accPct}%（還差 ${progress.accuracy.gapPct}%）`;

  const sampleText = progress.sample.met
    ? ''
    : `　近期作答 ${progress.sample.current}/${progress.sample.needed} 題（再答 ${progress.sample.remaining} 題就能解鎖）`;

  return `<span class="fusion-elig">${pairMark} ${pairText}　${accMark} ${accText}${sampleText}</span>`;
}

function renderForge() {
  const meta = getMeta();
  const forge = $('fusion-panel-forge');
  forge.innerHTML = '';

  // 若正處於「融合成功→選被動」流程，優先顯示該面板，蓋過類別卡列表。
  if (pendingPassiveCubId) {
    forge.appendChild(renderPassivePicker(meta, pendingPassiveCubId));
    return;
  }

  // 若已選好雙親、等待確認融合，顯示確認面板。
  if (picked.petA && picked.petB) {
    forge.appendChild(renderConfirmFuse(meta));
    return;
  }

  for (const category of CATEGORIES) {
    forge.appendChild(renderCategoryCard(meta, category));
  }
}

function renderCategoryCard(meta, category) {
  const e = getEligibility(meta, category);
  const preview = getFusionPreview(meta, category);
  const revealState = getRevealState(meta, category, getToday());

  const card = document.createElement('div');
  card.className = 'fusion-cat-card';

  const head = document.createElement('div');
  head.className = 'fusion-cat-card__head';
  head.innerHTML = `<b>${category}系</b>${eligibilityBadge(e.reasons, e.progress)}`;
  card.appendChild(head);

  const recipe = document.createElement('div');
  recipe.className = 'fusion-cat-card__recipe';
  if (preview.known) {
    recipe.innerHTML = preview.cub
      ? `<span class="fusion-recipe-known">下一隻：${esc(preview.cub.name)}（稱號：${esc(preview.cub.titles.join('／'))}）</span>`
      : `<span class="fusion-recipe-known">本類別稚靈已全數融合完成</span>`;
  } else {
    recipe.innerHTML =
      `<img class="fusion-recipe-img is-silhouette" alt="？？？">` +
      `<span class="fusion-recipe-unknown">？？？</span>`;
    if (!revealState.revealed) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fusion-reveal-btn';
      btn.textContent = revealState.lockedToday ? '今天猜過了，明天再來' : '答對隱藏題可揭曉';
      btn.disabled = revealState.lockedToday;
      btn.addEventListener('click', () => openRiddle(category));
      recipe.appendChild(btn);
    }
  }
  card.appendChild(recipe);

  if (e.eligible) {
    const fuseBtn = document.createElement('button');
    fuseBtn.type = 'button';
    fuseBtn.className = 'fusion-start-btn';
    const balance = getCrystalBalance(meta);
    fuseBtn.textContent = `選雙親融合（${FUSE_COST} 墨晶）`;
    fuseBtn.disabled = balance < FUSE_COST;
    fuseBtn.addEventListener('click', () => {
      picked = { category, petA: null, petB: null };
      renderForge();
    });
    card.appendChild(fuseBtn);
  }

  // 進入「選雙親」狀態：本類別已被選定，顯示滿級神獸列表可勾選兩隻。
  if (picked.category === category && !picked.petB) {
    card.appendChild(renderPetPicker(meta, e.maxLevelPets));
  }

  return card;
}

function renderPetPicker(meta, maxLevelPetIds) {
  const box = document.createElement('div');
  box.className = 'fusion-pet-picker';
  const list = document.createElement('div');
  list.className = 'fusion-pet-picker__list';
  for (const petId of maxLevelPetIds) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `fusion-pet-picker__btn${picked.petA === petId ? ' is-picked' : ''}`;
    btn.textContent = petId;
    btn.addEventListener('click', () => {
      if (picked.petA === petId) { picked.petA = null; renderForge(); return; }
      if (!picked.petA) { picked.petA = petId; renderForge(); return; }
      if (picked.petA !== petId) { picked.petB = petId; renderForge(); }
    });
    list.appendChild(btn);
  }
  box.appendChild(list);
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'fusion-cancel-btn';
  cancel.textContent = '取消';
  cancel.addEventListener('click', () => { picked = { category: null, petA: null, petB: null }; renderForge(); });
  box.appendChild(cancel);
  return box;
}

function renderConfirmFuse(meta) {
  const box = document.createElement('div');
  box.className = 'fusion-confirm';
  const cooldown = getPairCooldown(meta, picked.petA, picked.petB, getToday());
  box.innerHTML =
    `<p>雙親：${esc(picked.petA)} × ${esc(picked.petB)}</p>` +
    `<p>雙親融合後不會消失，仍可繼續出戰。融合花費 ${FUSE_COST} 墨晶。</p>` +
    (cooldown.onCooldown
      ? `<p class="fusion-cooldown-hint">這對雙親今天已經試過融合了，讓牠們先歇口氣，明天再來挑戰！</p>`
      : '');

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'fusion-start-btn';
  confirmBtn.textContent = cooldown.onCooldown ? '明天再來' : '確認融合';
  confirmBtn.disabled = cooldown.onCooldown;
  confirmBtn.addEventListener('click', () => {
    if (cooldown.onCooldown) return;
    const r = fuse(meta, picked.petA, picked.petB, { today: getToday() });
    picked = { category: null, petA: null, petB: null };
    if (!r.ok) { saveMeta(meta); onChange(); render(); return; }
    if (r.result === 'success') {
      pendingPassiveCubId = r.cub.id;
      saveMeta(meta); onChange();
      renderFuseResult({ result: 'success', cub: r.cub });
    } else {
      saveMeta(meta); onChange();
      renderFuseResult({ result: 'fail', line: r.line, pearls: r.pearls });
    }
  });
  box.appendChild(confirmBtn);

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'fusion-cancel-btn';
  cancel.textContent = '取消';
  cancel.addEventListener('click', () => { picked = { category: null, petA: null, petB: null }; renderForge(); });
  box.appendChild(cancel);

  return box;
}

// 融合結果提示（成功／失敗共用一個浮層區塊，蓋在 forge 面板頂端）。
function renderFuseResult({ result, cub, line, pearls }) {
  const forge = $('fusion-panel-forge');
  const box = document.createElement('div');
  box.className = 'fusion-result';
  if (result === 'success') {
    box.innerHTML =
      `<p class="fusion-result__born">「${esc(cub.bornLine)}」</p>` +
      `<p class="fusion-result__title">${esc(cub.name)}・${esc(cub.title)} 誕生了！</p>`;
  } else {
    // 白帽硬規則：失敗只顯示安慰台詞＋字珠變化，不列任何損失清單；
    // 時間冷卻是「等待」不是「沒收」，故只提示明天再來，不帶懲罰語氣。
    box.innerHTML =
      `<p class="fusion-result__line">${esc(line)}</p>` +
      `<p class="fusion-result__pearls">獲得 ${pearls} 顆安慰字珠</p>` +
      `<p class="fusion-result__cooldown">這對雙親今天先讓牠們歇口氣，明天再挑戰一次！</p>`;
    const okBtn = document.createElement('button');
    okBtn.type = 'button';
    okBtn.className = 'fusion-start-btn';
    okBtn.textContent = '知道了';
    okBtn.addEventListener('click', renderForge);
    box.appendChild(okBtn);
  }
  forge.prepend(box);
}

function renderPassivePicker(meta, cubId) {
  const box = document.createElement('div');
  box.className = 'fusion-passive-picker';
  box.innerHTML = `<p class="fusion-passive-picker__hint">選一個被動能力，稚靈隨行出戰時生效：</p>`;
  for (const p of CUB_PASSIVES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fusion-passive-btn';
    btn.innerHTML = `<b>${esc(p.name)}</b><span>${esc(p.desc)}</span>`;
    btn.addEventListener('click', () => {
      const r = chooseCubPassive(meta, cubId, p.id);
      if (!r.ok) return;
      saveMeta(meta); onChange();
      renderNicknamePanel(cubId);
    });
    box.appendChild(btn);
  }
  return box;
}

function renderNicknamePanel(cubId) {
  pendingPassiveCubId = null;
  const forge = $('fusion-panel-forge');
  forge.innerHTML = '';
  const meta = getMeta();
  const box = document.createElement('div');
  box.className = 'fusion-nickname-panel';
  box.innerHTML = `<p>幫牠取個暱稱吧（1–8 字，留空＝用本名）：</p>`;

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 8;
  input.className = 'fusion-nickname-input';
  box.appendChild(input);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'fusion-start-btn';
  saveBtn.textContent = '確定';
  saveBtn.addEventListener('click', () => {
    const r = setCubNickname(meta, cubId, input.value);
    if (!r.ok) return;
    saveMeta(meta); onChange();
    renderCardPanel(cubId);
  });
  box.appendChild(saveBtn);

  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'fusion-cancel-btn';
  skipBtn.textContent = '先跳過';
  skipBtn.addEventListener('click', () => renderCardPanel(cubId));
  box.appendChild(skipBtn);

  forge.appendChild(box);
}

function renderCardPanel(cubId) {
  const forge = $('fusion-panel-forge');
  forge.innerHTML = '';
  const meta = getMeta();
  const data = buildCubCardData(meta, cubId);

  const box = document.createElement('div');
  box.className = 'fusion-card-panel';
  box.innerHTML = `<p>名片做好了！可以下載或分享出去：</p>`;

  const canvas = $('fusion-card-canvas');
  canvas.hidden = false;
  renderCubCard(canvas, data);

  const dlBtn = document.createElement('button');
  dlBtn.type = 'button';
  dlBtn.className = 'fusion-start-btn';
  dlBtn.textContent = '產生名片';
  dlBtn.addEventListener('click', () => exportShareCard(canvas));
  box.appendChild(dlBtn);

  const doneBtn = document.createElement('button');
  doneBtn.type = 'button';
  doneBtn.className = 'fusion-cancel-btn';
  doneBtn.textContent = '完成';
  doneBtn.addEventListener('click', () => { canvas.hidden = true; render(); });
  box.appendChild(doneBtn);

  forge.appendChild(box);
}

// —— 隱藏題揭曉 ——

function openRiddle(category) {
  const meta = getMeta();
  const state = getRevealState(meta, category, getToday());
  const forge = $('fusion-panel-forge');
  forge.innerHTML = '';

  const box = document.createElement('div');
  box.className = 'fusion-riddle-panel';

  if (state.revealed) { render(); return; }
  if (state.lockedToday) {
    box.innerHTML = `<p>今天猜過了，明天再來。</p>`;
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'fusion-cancel-btn';
    back.textContent = '返回';
    back.addEventListener('click', renderForge);
    box.appendChild(back);
    forge.appendChild(box);
    return;
  }

  const riddle = state.riddle;
  box.innerHTML = `<p class="fusion-riddle-panel__q">${esc(riddle.question)}</p>`;
  riddle.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'fusion-riddle-panel__opt';
    btn.textContent = opt;
    btn.addEventListener('click', () => {
      const r = answerRevealRiddle(meta, category, i, getToday());
      saveMeta(meta); onChange();
      if (r.correct) {
        box.innerHTML = `<p class="fusion-riddle-panel__correct">答對了！配方已揭曉——</p>`;
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'fusion-start-btn';
        back.textContent = '查看';
        back.addEventListener('click', renderForge);
        box.appendChild(back);
      } else {
        box.innerHTML = `<p class="fusion-riddle-panel__wrong">答錯了，今天猜過了，明天再來。</p>`;
        const back = document.createElement('button');
        back.type = 'button';
        back.className = 'fusion-cancel-btn';
        back.textContent = '返回';
        back.addEventListener('click', renderForge);
        box.appendChild(back);
      }
    });
    box.appendChild(btn);
  });

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'fusion-cancel-btn';
  back.textContent = '取消';
  back.addEventListener('click', renderForge);
  box.appendChild(back);

  forge.appendChild(box);
}

// —— 稚靈收藏頁 ——

function renderCubs() {
  const meta = getMeta();
  const cubs = listCubs(meta);
  const box = $('fusion-panel-cubs');
  box.innerHTML = '';

  if (!cubs.length) {
    box.innerHTML = `<p class="fusion-cubs-empty">還沒有稚靈——先去融合坊湊齊雙親試試看吧。</p>`;
    return;
  }

  for (const c of cubs) {
    box.appendChild(renderCubCardItem(meta, c));
  }
}

function renderCubCardItem(meta, c) {
  const card = document.createElement('div');
  card.className = `fusion-cub-card${c.isActive ? ' is-active' : ''}`;

  const img = document.createElement('img');
  img.className = 'fusion-cub-card__img';
  img.src = `assets/web/cub-${c.id}.jpg`;
  img.alt = c.name;
  img.loading = 'lazy';
  img.addEventListener('error', () => img.classList.add('is-silhouette'));
  card.appendChild(img);

  const body = document.createElement('div');
  body.className = 'fusion-cub-card__body';
  body.innerHTML =
    `<span class="fusion-cub-card__name">${esc(c.displayName)}<span class="fusion-cub-card__cat">${esc(c.category)}</span></span>` +
    `<span class="fusion-cub-card__title">「${esc(c.title)}」</span>` +
    (c.isActive ? '<span class="fusion-cub-card__badge">隨行中</span>' : '');
  card.appendChild(body);

  const actions = document.createElement('div');
  actions.className = 'fusion-cub-card__actions';

  const activeBtn = document.createElement('button');
  activeBtn.type = 'button';
  activeBtn.className = 'fusion-cub-card__btn';
  activeBtn.textContent = c.isActive ? '取消隨行' : '隨行出戰';
  activeBtn.addEventListener('click', () => {
    if (c.isActive) clearActiveCub(meta); else setActiveCub(meta, c.id);
    saveMeta(meta); onChange(); renderCubs();
  });
  actions.appendChild(activeBtn);

  const nickBtn = document.createElement('button');
  nickBtn.type = 'button';
  nickBtn.className = 'fusion-cub-card__btn';
  nickBtn.textContent = '改暱稱';
  nickBtn.addEventListener('click', () => renderCubNicknameEdit(meta, c));
  actions.appendChild(nickBtn);

  const cardBtn = document.createElement('button');
  cardBtn.type = 'button';
  cardBtn.className = 'fusion-cub-card__btn';
  cardBtn.textContent = '看名片';
  cardBtn.addEventListener('click', () => {
    switchTab('forge');
    renderCardPanel(c.id);
  });
  actions.appendChild(cardBtn);

  card.appendChild(actions);
  return card;
}

function renderCubNicknameEdit(meta, c) {
  const box = $('fusion-panel-cubs');
  box.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'fusion-nickname-panel';
  wrap.innerHTML = `<p>幫「${esc(c.name)}」取暱稱（留空＝回本名）：</p>`;

  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 8;
  input.className = 'fusion-nickname-input';
  input.value = c.nickname || '';
  wrap.appendChild(input);

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'fusion-start-btn';
  saveBtn.textContent = '確定';
  saveBtn.addEventListener('click', () => {
    const r = setCubNickname(meta, c.id, input.value);
    if (!r.ok) return;
    saveMeta(meta); onChange(); renderCubs();
  });
  wrap.appendChild(saveBtn);

  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.className = 'fusion-cancel-btn';
  cancel.textContent = '取消';
  cancel.addEventListener('click', renderCubs);
  wrap.appendChild(cancel);

  box.appendChild(wrap);
}
