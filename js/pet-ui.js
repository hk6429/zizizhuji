// 寵物閣 UI：山海神獸列表（選主寵）＋寵物設備（購買／安裝）。
// 資料與規則全走 js/meta/pet.js；本檔只負責渲染與事件，存檔經 saveMeta。

import { saveMeta } from './meta/store.js';
import {
  PET_EQUIP, EQUIP_SLOTS, EQUIP_MAX_LEVEL,
  listPets, setActivePet, buyEquip, installEquip, uninstallEquip, setPetNickname,
  setSubPet, clearSubPet, upgradeEquip, getEquipLevel,
} from './meta/pet.js';
import { getBalance } from './meta/economy.js';
import { getWeaknessSummary } from './meta/weakness.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const BOND_EMOJI = ['😐', '🙂', '😄'];
let expandedBioId = null;

const $ = (id) => document.getElementById(id);
const EQUIP_BY_ID = new Map(PET_EQUIP.map((e) => [e.id, e]));

// 暱稱是使用者輸入，插進 innerHTML 前先轉義
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

let getMeta = () => null;
let onChange = () => {};

export function initPetUI(opts) {
  getMeta = opts.getMeta;
  onChange = opts.onChange || (() => {});

  $('btn-pet').addEventListener('click', open);
  $('pet-close').addEventListener('click', close);
  $('pet-nickname-save').addEventListener('click', () => {
    const meta = getMeta();
    const active = listPets(meta).find((x) => x.active);
    if (!active) return;
    const r = setPetNickname(meta, active.id, $('pet-nickname-input').value);
    if (r.ok) { saveMeta(meta); onChange(); render(); }
  });

  for (const tab of document.querySelectorAll('.pet-tab')) {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  }
}

function open() {
  if (!getMeta()) return;
  switchTab('pets');
  render();
  openOverlay($('pet-overlay'), close);
}

function close() { closeOverlay($('pet-overlay')); }

function switchTab(name) {
  for (const tab of document.querySelectorAll('.pet-tab')) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  $('pet-panel-pets').hidden = name !== 'pets';
  $('pet-panel-equip').hidden = name !== 'equip';
}

function render() {
  renderPets();
  renderEquip();
}

function pctToNext(p) {
  if (p.nextAt === null) return 100;
  const prev = p.level * 20; // LEVEL_STEP
  return Math.min(100, Math.round(((p.mastery - prev) / (p.nextAt - prev)) * 100));
}

function renderPets() {
  const meta = getMeta();
  const pets = listPets(meta);

  // 暱稱列：有主寵才顯示，輸入框帶入現有暱稱
  const active = pets.find((x) => x.active);
  const nickRow = $('pet-nickname-row');
  nickRow.hidden = !active;
  if (active) {
    $('pet-nickname-input').value = active.nickname || '';
    $('pet-nickname-input').placeholder = `幫「${active.name}」取暱稱（1–8 字，清空＝回本名）`;
  }

  $('pet-progress-count').textContent = pets.filter((p) => p.unlocked).length;

  const grid = $('pet-grid');
  grid.innerHTML = '';
  for (const p of pets) {
    const card = document.createElement('div');
    card.className = `pet-card-item${p.unlocked ? '' : ' is-locked'}${p.active ? ' is-active' : ''}`;

    const main = document.createElement('button');
    main.type = 'button';
    main.className = 'pet-card-item__main';
    main.disabled = !p.unlocked;

    const img = document.createElement('img');
    img.className = 'pet-card-item__img';
    img.src = `assets/web/pet-${p.id}.jpg`;
    img.alt = p.name;
    img.loading = 'lazy';

    const body = document.createElement('div');
    body.className = 'pet-card-item__body';
    const status = p.unlocked
      ? `${p.level} 級｜精通 ${p.mastery}${p.nextAt === null ? '（已滿級）' : ` / ${p.nextAt}`}`
      : `精通 ${p.category} ${p.unlockAt} 題解鎖`;
    const bondEmoji = p.unlocked ? BOND_EMOJI[p.bondStage] : '';
    const badgeCount = p.badges.length;
    body.innerHTML =
      `<span class="pet-card-item__name">${p.nickname ? `${esc(p.nickname)}・${p.name}` : p.name} ${bondEmoji}` +
      `<span class="pet-card-item__cat">${p.category}</span></span>` +
      `<span class="pet-card-item__status">${p.unlocked ? '' : '🔒 '}${status}</span>` +
      `<span class="pet-track"><span class="pet-track__fill" style="width:${p.unlocked ? pctToNext(p) : 0}%"></span></span>` +
      (p.unlocked ? `<span class="pet-card-item__bond">${p.bondStageName}${badgeCount ? `｜🏅×${badgeCount}` : ''}</span>` : '') +
      (p.active ? '<span class="pet-card-item__badge">出戰中</span>'
                : (p.isSub ? '<span class="pet-card-item__badge pet-card-item__badge--sub">副寵</span>'
                : (p.unlocked ? '<span class="pet-card-item__hint">點我出戰</span>' : '')));

    main.append(img, body);
    if (p.unlocked && !p.active) {
      main.addEventListener('click', () => {
        setActivePet(meta, p.id);
        saveMeta(meta);
        onChange();
        render();
      });
    }
    card.appendChild(main);

    if (p.unlocked) {
      const actions = document.createElement('div');
      actions.className = 'pet-card-item__actions';

      const subBtn = document.createElement('button');
      subBtn.type = 'button';
      subBtn.className = 'pet-card-item__sub-btn';
      subBtn.disabled = p.active;
      subBtn.textContent = p.isSub ? '取消副寵' : '設副寵';
      subBtn.addEventListener('click', () => {
        if (p.isSub) clearSubPet(meta); else setSubPet(meta, p.id);
        saveMeta(meta);
        onChange();
        render();
      });

      const bioBtn = document.createElement('button');
      bioBtn.type = 'button';
      bioBtn.className = 'pet-card-item__bio-btn';
      bioBtn.textContent = expandedBioId === p.id ? '收合小傳' : '查看小傳';
      bioBtn.addEventListener('click', () => {
        expandedBioId = expandedBioId === p.id ? null : p.id;
        renderPets();
      });

      actions.append(subBtn, bioBtn);
      card.appendChild(actions);

      if (expandedBioId === p.id) card.appendChild(renderBio(meta, p));
    }

    grid.appendChild(card);
  }
}

function renderBio(meta, p) {
  const box = document.createElement('div');
  box.className = 'pet-card-item__bio';
  const unlockedDate = p.unlockedAt ? new Date(p.unlockedAt).toLocaleDateString('zh-TW') : '未知';
  const weakSummary = getWeaknessSummary(meta).filter((w) => petCategoryTypes(p.category).includes(w.type));
  const weakLine = weakSummary.length
    ? `本週正確率最低：${weakSummary[0].type}（${Math.round(weakSummary[0].accuracy * 100)}%）`
    : '本週尚無弱點紀錄';
  box.innerHTML =
    `<p>「${esc(p.line)}」</p>` +
    `<p>解鎖於 ${unlockedDate}｜羈絆階段：${p.bondStageName}｜徽章 ${p.badges.length} 枚</p>` +
    `<p>${weakLine}</p>`;
  return box;
}

function petCategoryTypes(category) {
  if (category === '字音') return ['字音', '字形'];
  if (category === '成語') return ['意義', '近似成語', '錯別字'];
  return ['字音', '字形', '意義', '近似成語', '錯別字'];
}

function renderEquip() {
  const meta = getMeta();
  $('pet-equip-pearls').textContent = getBalance(meta);

  const active = listPets(meta).find((x) => x.active);
  const activeLabel = $('pet-equip-active');
  activeLabel.textContent = active
    ? `${active.name}（${active.equipped.length}/${EQUIP_SLOTS} 格）`
    : '未選主寵，先去神獸頁選一隻';

  const grid = $('pet-equip-grid');
  grid.innerHTML = '';
  const owned = new Set(meta.pet.ownedEquip || []);
  const installed = new Set(active ? active.equipped : []);

  for (const e of PET_EQUIP) {
    const row = document.createElement('div');
    row.className = 'pet-equip-item';
    const icon = document.createElement('img');
    icon.className = 'pet-equip-item__icon';
    icon.src = `assets/web/pet-equip-${e.id}.jpg`;
    icon.alt = '';
    icon.loading = 'lazy';
    const level = getEquipLevel(meta, e.id);
    const info = document.createElement('div');
    info.className = 'pet-equip-item__info';
    info.innerHTML = `<b>${e.name} <span class="pet-equip-item__tier">${e.tier}</span>` +
      (owned.has(e.id) ? ` <span class="pet-equip-item__lv">Lv.${level}</span>` : '') +
      `</b><span>${e.desc}</span>`;

    const action = document.createElement('div');
    action.className = 'pet-equip-item__action';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pet-equip-btn';

    if (!owned.has(e.id)) {
      btn.textContent = `${e.price} 珠 購買`;
      btn.disabled = getBalance(meta) < e.price;
      btn.addEventListener('click', () => {
        if (buyEquip(meta, e.id).ok) { saveMeta(meta); onChange(); renderEquip(); }
      });
    } else if (installed.has(e.id)) {
      btn.textContent = '卸下';
      btn.classList.add('is-installed');
      btn.addEventListener('click', () => {
        if (uninstallEquip(meta, active.id, e.id).ok) { saveMeta(meta); renderEquip(); }
      });
    } else {
      btn.textContent = '安裝';
      btn.disabled = !active || active.equipped.length >= EQUIP_SLOTS;
      btn.addEventListener('click', () => {
        if (active && installEquip(meta, active.id, e.id).ok) { saveMeta(meta); renderEquip(); }
      });
    }
    action.appendChild(btn);

    if (owned.has(e.id) && level < EQUIP_MAX_LEVEL) {
      const gate = e.upgradeGate[level - 1];
      const cost = e.upgradeCost[level - 1];
      const upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'pet-equip-upgrade-btn';
      const best = Math.max(...listPets(meta).map((p) => p.mastery));
      upBtn.textContent = `升級 Lv.${level + 1}（${cost} 珠｜精通 ${gate}）`;
      upBtn.disabled = getBalance(meta) < cost || best < gate;
      upBtn.addEventListener('click', () => {
        if (upgradeEquip(meta, e.id).ok) { saveMeta(meta); onChange(); renderEquip(); }
      });
      action.appendChild(upBtn);
    }

    row.append(icon, info, action);
    grid.appendChild(row);
  }
}
