// 寵物閣 UI：山海神獸列表（選主寵）＋寵物設備（購買／安裝）。
// 資料與規則全走 js/meta/pet.js；本檔只負責渲染與事件，存檔經 saveMeta。

import { saveMeta } from './meta/store.js';
import {
  PET_EQUIP, EQUIP_SLOTS,
  listPets, setActivePet, buyEquip, installEquip, uninstallEquip,
} from './meta/pet.js';
import { getBalance } from './meta/economy.js';

const $ = (id) => document.getElementById(id);
const EQUIP_BY_ID = new Map(PET_EQUIP.map((e) => [e.id, e]));

let getMeta = () => null;
let onChange = () => {};

export function initPetUI(opts) {
  getMeta = opts.getMeta;
  onChange = opts.onChange || (() => {});

  $('btn-pet').addEventListener('click', open);
  $('pet-close').addEventListener('click', () => { $('pet-overlay').hidden = true; });

  for (const tab of document.querySelectorAll('.pet-tab')) {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  }
}

function open() {
  if (!getMeta()) return;
  switchTab('pets');
  render();
  $('pet-overlay').hidden = false;
}

function switchTab(name) {
  for (const tab of document.querySelectorAll('.pet-tab')) {
    tab.classList.toggle('is-active', tab.dataset.tab === name);
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
  const grid = $('pet-grid');
  grid.innerHTML = '';
  for (const p of listPets(meta)) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = `pet-card-item${p.unlocked ? '' : ' is-locked'}${p.active ? ' is-active' : ''}`;
    card.disabled = !p.unlocked;

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
    body.innerHTML =
      `<span class="pet-card-item__name">${p.name}` +
      `<span class="pet-card-item__cat">${p.category}</span></span>` +
      `<span class="pet-card-item__status">${p.unlocked ? '' : '🔒 '}${status}</span>` +
      `<span class="pet-track"><span class="pet-track__fill" style="width:${p.unlocked ? pctToNext(p) : 0}%"></span></span>` +
      (p.active ? '<span class="pet-card-item__badge">出戰中</span>'
                : (p.unlocked ? '<span class="pet-card-item__hint">點我出戰</span>' : ''));

    card.append(img, body);
    if (p.unlocked && !p.active) {
      card.addEventListener('click', () => {
        setActivePet(meta, p.id);
        saveMeta(meta);
        onChange();
        render();
      });
    }
    grid.appendChild(card);
  }
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
    const info = document.createElement('div');
    info.className = 'pet-equip-item__info';
    info.innerHTML = `<b>${e.name}</b><span>${e.desc}</span>`;

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
    row.append(icon, info, action);
    grid.appendChild(row);
  }
}
