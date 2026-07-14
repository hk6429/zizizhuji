// 山海經寵物系統：12 隻怪獸，各綁一個題庫類別（字音／成語／混合）。
// 「升級＝會多少字／成語」——寵物等級由「該類別已煉成字珠數（精通題數）」推算，不另存等級。
// 精通題數 = collection 裡 earnedAt 有值、且 id 前綴符合類別者（zy-＝字音、cy-＝成語）。
// 寵物設備：字珠購買 → 裝進主寵欄位（2 格）→ 戰鬥加成。加成一律折成 battle-adapter
// 既有的 opts.damageBonus / opts.freeEliminate，因此不必改 battle-adapter 或 battle.js。

import { spendPearls } from './economy.js';

export const LEVEL_STEP = 20;   // 每精通 20 題升 1 級
export const MAX_LEVEL = 10;
export const EQUIP_SLOTS = 2;

// category：'字音' | '成語' | '混合'。unlockAt：該類別精通題數達標即解鎖。
export const PETS = [
  // —— 字音類（聲音／語言意象）——
  { id: 'baize',    name: '白澤',   category: '字音', unlockAt: 0,  desc: '通曉萬物之語，助你辨音正讀。' },
  { id: 'kui',      name: '夔',     category: '字音', unlockAt: 10, desc: '一足雷獸，聲若洪鐘，鎮壓錯音。' },
  { id: 'bifang',   name: '畢方',   category: '字音', unlockAt: 30, desc: '一足火鳥，鳴聲清亮，讀音不失。' },
  { id: 'jiuwei',   name: '九尾狐',  category: '字音', unlockAt: 60, desc: '其音如嬰兒，媚而聰慧，最善正音。' },
  // —— 成語類（典故／文采意象）——
  { id: 'fenghuang', name: '鳳凰',  category: '成語', unlockAt: 0,  desc: '五色文彩之鳥，通曉古今典故。' },
  { id: 'yinglong',  name: '應龍',  category: '成語', unlockAt: 10, desc: '助禹治水的神龍，滿腹成語掌故。' },
  { id: 'taotie',    name: '饕餮',  category: '成語', unlockAt: 30, desc: '貪食異獸，「饕餮之徒」由其而生。' },
  { id: 'taowu',     name: '檮杌',  category: '成語', unlockAt: 60, desc: '古史之名，記人間善惡成敗。' },
  // —— 混合類（戰鬥／守護意象）——
  { id: 'qiongqi',  name: '窮奇',   category: '混合', unlockAt: 0,  desc: '有翼猛獸，戰意昂揚，攻守兼備。' },
  { id: 'dangkang', name: '當康',   category: '混合', unlockAt: 15, desc: '豐年之兆，字珠盈滿則現身相助。' },
  { id: 'luwu',     name: '陸吾',   category: '混合', unlockAt: 45, desc: '崑崙守神，虎身九尾，護你不敗。' },
  { id: 'kun',      name: '鯤',     category: '混合', unlockAt: 90, desc: '北冥巨魚，化而為鵬，變化無窮。' },
];

// 寵物設備：字珠購買，裝進主寵欄位給戰鬥加成。
export const PET_EQUIP = [
  { id: 'wo',      name: '玲瓏獸窩',  price: 120, desc: '安居靈獸，戰鬥傷害 +1',        effect: { damageBonus: 1 } },
  { id: 'xirang',  name: '息壤靈符',  price: 150, desc: '生生不息，戰鬥傷害 +2',        effect: { damageBonus: 2 } },
  { id: 'ling',    name: '昆吾靈鈴',  price: 180, desc: '開場多排除一個錯誤選項',        effect: { freeEliminate: 1 } },
  { id: 'zhulong', name: '燭龍之睛',  price: 220, desc: '燭照九幽，戰鬥傷害 +3',        effect: { damageBonus: 3 } },
];

const PET_BY_ID = new Map(PETS.map((p) => [p.id, p]));
const EQUIP_BY_ID = new Map(PET_EQUIP.map((e) => [e.id, e]));

function ensurePetState(meta) {
  if (!meta.pet) meta.pet = { seen: {}, active: null, ownedEquip: [], equipped: {} };
  const s = meta.pet;
  if (!s.seen) s.seen = {};
  if (!s.ownedEquip) s.ownedEquip = [];
  if (!s.equipped) s.equipped = {};
  return s;
}

// 某類別的精通題數（已煉成字珠）。字音＝zy- 前綴、成語＝cy- 前綴、混合＝全部。
export function categoryMastery(meta, category) {
  let n = 0;
  for (const [id, r] of Object.entries(meta.collection || {})) {
    if (!r || !r.earnedAt) continue;
    if (category === '混合') { n += 1; continue; }
    if (category === '字音' && id.startsWith('zy-')) n += 1;
    else if (category === '成語' && id.startsWith('cy-')) n += 1;
  }
  return n;
}

export function petLevel(meta, pet) {
  const p = typeof pet === 'string' ? PET_BY_ID.get(pet) : pet;
  if (!p) return 0;
  const mastery = categoryMastery(meta, p.category);
  return Math.min(MAX_LEVEL, Math.floor(mastery / LEVEL_STEP));
}

export function isUnlocked(meta, pet) {
  const p = typeof pet === 'string' ? PET_BY_ID.get(pet) : pet;
  if (!p) return false;
  return categoryMastery(meta, p.category) >= p.unlockAt;
}

// 寵物閣列表：含解鎖狀態、等級、精通數、下一級門檻。
export function listPets(meta) {
  ensurePetState(meta);
  return PETS.map((p) => {
    const mastery = categoryMastery(meta, p.category);
    const level = Math.min(MAX_LEVEL, Math.floor(mastery / LEVEL_STEP));
    const nextAt = level >= MAX_LEVEL ? null : (level + 1) * LEVEL_STEP;
    return {
      id: p.id, name: p.name, category: p.category, desc: p.desc,
      unlocked: mastery >= p.unlockAt, unlockAt: p.unlockAt,
      mastery, level, nextAt,
      active: meta.pet.active === p.id,
      equipped: (meta.pet.equipped[p.id] || []).slice(),
    };
  });
}

// 掃描新解鎖的寵物，回傳一次性事件（seen 去重）。載入與答題後呼叫。
export function syncUnlocks(meta) {
  const s = ensurePetState(meta);
  const events = [];
  for (const p of PETS) {
    if (categoryMastery(meta, p.category) >= p.unlockAt && !s.seen[p.id]) {
      s.seen[p.id] = true;
      events.push({ type: 'petUnlocked', payload: { id: p.id, name: p.name, category: p.category }, fx: 'pet-appear' });
    }
  }
  return { meta, events };
}

export function setActivePet(meta, petId) {
  const s = ensurePetState(meta);
  if (!PET_BY_ID.has(petId)) return { meta, ok: false, reason: 'not-found' };
  if (!isUnlocked(meta, petId)) return { meta, ok: false, reason: 'locked' };
  s.active = petId;
  return { meta, ok: true, reason: null };
}

export function buyEquip(meta, equipId) {
  const s = ensurePetState(meta);
  const item = EQUIP_BY_ID.get(equipId);
  if (!item) return { meta, ok: false, reason: 'not-found' };
  if (s.ownedEquip.includes(equipId)) return { meta, ok: false, reason: 'owned' };
  const paid = spendPearls(meta, item.price, `pet-equip:${equipId}`);
  if (!paid.ok) return { meta, ok: false, reason: 'pearls' };
  s.ownedEquip.push(equipId);
  return { meta, ok: true, reason: null };
}

export function installEquip(meta, petId, equipId) {
  const s = ensurePetState(meta);
  if (!PET_BY_ID.has(petId)) return { meta, ok: false, reason: 'not-found' };
  if (!s.ownedEquip.includes(equipId)) return { meta, ok: false, reason: 'not-owned' };
  const slots = s.equipped[petId] || (s.equipped[petId] = []);
  if (slots.includes(equipId)) return { meta, ok: false, reason: 'installed' };
  if (slots.length >= EQUIP_SLOTS) return { meta, ok: false, reason: 'full' };
  slots.push(equipId);
  return { meta, ok: true, reason: null };
}

export function uninstallEquip(meta, petId, equipId) {
  const s = ensurePetState(meta);
  const slots = s.equipped[petId];
  if (!slots) return { meta, ok: false, reason: 'not-installed' };
  const i = slots.indexOf(equipId);
  if (i < 0) return { meta, ok: false, reason: 'not-installed' };
  slots.splice(i, 1);
  return { meta, ok: true, reason: null };
}

// 主寵＋其裝備折算成戰鬥加成，餵進 createBattleContext 的 opts。
// 主寵被動：每級 +1 傷害。設備：各自 effect 疊加。
export function getPetBattleMods(meta) {
  const s = ensurePetState(meta);
  const mods = { damageBonus: 0, freeEliminate: 0 };
  const petId = s.active;
  if (!petId || !isUnlocked(meta, petId)) return mods;
  mods.damageBonus += petLevel(meta, petId);
  for (const equipId of s.equipped[petId] || []) {
    const item = EQUIP_BY_ID.get(equipId);
    if (!item) continue;
    if (item.effect.damageBonus) mods.damageBonus += item.effect.damageBonus;
    if (item.effect.freeEliminate) mods.freeEliminate += item.effect.freeEliminate;
  }
  return mods;
}
