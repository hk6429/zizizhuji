// 山海經寵物系統：12 隻怪獸，各綁一個題庫類別（字音／成語／混合）。
// 「升級＝會多少字／成語」——寵物等級由「該類別已煉成字珠數（精通題數，弱點題加權）」推算，不另存等級。
// 精通題數 = collection 裡 earnedAt 有值、且 id 前綴符合類別者（zy-＝字音、cy-＝成語）；
// 曾答錯過的題（wrong > 0）煉成時加權 1.5 倍，鼓勵攻克弱點。
// 寵物設備：字珠購買 → 裝進主寵欄位（2 格）→ 戰鬥加成，可分級升級。加成一律折成 battle-adapter
// 既有的 opts.damageBonus / opts.freeEliminate，因此不必改 battle-adapter 或 battle.js。
//
// 羈絆（meta.pet.bond）是「寵物專屬」的陪伴值，跟 js/meta/bond.js 的「墨靈」（戰鬥敘事夥伴，
// meta.bond）是完全不同的兩個角色與資料線，切勿混用。

import { spendPearls } from './economy.js';

export const LEVEL_STEP = 20;   // 每精通 20 題升 1 級
export const MAX_LEVEL = 15;
export const EQUIP_SLOTS = 2;
export const WRONG_MASTERY_WEIGHT = 1.5; // 曾答錯過才煉成的題，精通貢獻加權

// category：'字音' | '成語' | '混合'。unlockAt：該類別精通題數達標即解鎖。
// lines：羈絆三階段情境台詞 [初見, 漸熟, 知己]，供寵物閣卡片顯示（見 PET_BOND_STAGES）。
export const PETS = [
  // —— 字音類（聲音／語言意象）——
  { id: 'baize',    name: '白澤',   category: '字音', unlockAt: 0,  desc: '通曉萬物之語，助你辨音正讀。',
    lines: ['初次相見，我便嗅出你身上的墨氣——是塊讀音的璞玉。', '這陣子聽你正音，字字漸漸站穩了。', '你的音準，已是我見過最踏實的一位。'] },
  { id: 'kui',      name: '夔',     category: '字音', unlockAt: 10, desc: '一足雷獸，聲若洪鐘，鎮壓錯音。',
    lines: ['轟——別怕，我的吼聲是為錯音而發，不是為你。', '你的聲線越來越穩，雷聲都替你放輕了。', '與你同行，錯音再無處遁形。'] },
  { id: 'bifang',   name: '畢方',   category: '字音', unlockAt: 30, desc: '一足火鳥，鳴聲清亮，讀音不失。',
    lines: ['我一足獨立，卻願為你多留一刻。', '你唸字的節奏，像我的鳴聲一樣清亮了。', '你我已是知音，讀音再難也難不倒我們。'] },
  { id: 'jiuwei',   name: '九尾狐',  category: '字音', unlockAt: 60, desc: '其音如嬰兒，媚而聰慧，最善正音。',
    lines: ['嗯？你倒是頭一個讓我想多說幾句話的人。', '你的耳朵越來越靈了，連我都要認真起來。', '九條尾巴都認得你——你是我最珍惜的知己。'] },
  // —— 成語類（典故／文采意象）——
  { id: 'fenghuang', name: '鳳凰',  category: '成語', unlockAt: 0,  desc: '五色文彩之鳥，通曉古今典故。',
    lines: ['初見便知，你將來必是懂典故的人。', '你引用成語的模樣，越來越有文采了。', '你我這段緣分，正如鳳鳴朝陽，值得傳頌。'] },
  { id: 'yinglong',  name: '應龍',  category: '成語', unlockAt: 10, desc: '助禹治水的神龍，滿腹成語掌故。',
    lines: ['治水尚且需要耐心，學成語也是。', '你記典故的方式，讓我想起當年治水的智慧。', '有你在，這身掌故終於找到能傳下去的人。'] },
  { id: 'taotie',    name: '饕餮',  category: '成語', unlockAt: 30, desc: '貪食異獸，「饕餮之徒」由其而生。',
    lines: ['別怕我這惡名，我只貪你答對時的那份認真。', '你對成語的胃口，倒是越來越大了。', '難得有人陪我把「饕餮」二字，變成一段好故事。'] },
  { id: 'taowu',     name: '檮杌',  category: '成語', unlockAt: 60, desc: '古史之名，記人間善惡成敗。',
    lines: ['我記人間善惡，如今也記下了你的努力。', '你走過的每一題，我都仔細記在史冊裡。', '這段共同寫成的史頁，是我最珍視的一章。'] },
  // —— 混合類（戰鬥／守護意象）——
  { id: 'qiongqi',  name: '窮奇',   category: '混合', unlockAt: 0,  desc: '有翼猛獸，戰意昂揚，攻守兼備。',
    lines: ['初上陣，就讓我看看你的膽識。', '並肩幾場下來，你的攻守越來越有章法。', '有你在陣中，我這雙翼再無所懼。'] },
  { id: 'dangkang', name: '當康',   category: '混合', unlockAt: 15, desc: '豐年之兆，字珠盈滿則現身相助。',
    lines: ['字珠漸豐，是你我相遇的好兆頭。', '你的字珠越積越滿，我也越來越安心。', '有你這般豐年之相，我願常伴你左右。'] },
  { id: 'luwu',     name: '陸吾',   category: '混合', unlockAt: 45, desc: '崑崙守神，虎身九尾，護你不敗。',
    lines: ['崑崙之下，我先護你這一程。', '你越戰越沉穩，倒讓我這守神放心不少。', '你我並肩，便是我守護崑崙以來最安心的時刻。'] },
  { id: 'kun',      name: '鯤',     category: '混合', unlockAt: 90, desc: '北冥巨魚，化而為鵬，變化無窮。',
    lines: ['北冥雖大，能與你相遇也是難得。', '你的成長，如我化鵬之路一般不凡。', '這一路蛻變，你我終究一起飛過了北冥。'] },
];

// 寵物設備：字珠購買，裝進主寵欄位給戰鬥加成，可花珠升級（Lv.1→2→3，效果倍率 ×1/×1.5/×2）。
// tier 純顯示用（沿用 collection.js GRADES 的命名風格），依現有價格分級對應，不影響任何戰鬥數值。
// upgradeCost[i]：升到 Lv.(i+2) 的字珠花費；upgradeGate[i]：升到 Lv.(i+2) 需要的任一類別精通門檻。
export const PET_EQUIP = [
  { id: 'wo',      name: '玲瓏獸窩',  price: 120, tier: '白', desc: '安居靈獸，戰鬥傷害 +1',        effect: { damageBonus: 1 },
    upgradeCost: [80, 160], upgradeGate: [10, 30] },
  { id: 'xirang',  name: '息壤靈符',  price: 150, tier: '青', desc: '生生不息，戰鬥傷害 +2',        effect: { damageBonus: 2 },
    upgradeCost: [100, 200], upgradeGate: [10, 30] },
  { id: 'ling',    name: '昆吾靈鈴',  price: 180, tier: '金', desc: '開場多排除一個錯誤選項',        effect: { freeEliminate: 1 },
    upgradeCost: [120, 240], upgradeGate: [30, 60] },
  { id: 'zhulong', name: '燭龍之睛',  price: 220, tier: '墨玉', desc: '燭照九幽，戰鬥傷害 +3',        effect: { damageBonus: 3 },
    upgradeCost: [150, 300], upgradeGate: [30, 60] },
];

export const EQUIP_MAX_LEVEL = 3;
const EQUIP_LEVEL_MULT = { 1: 1, 2: 1.5, 3: 2 };

// 羈絆三階段：0–100，脫鉤於類別精通等級，答對時累加（見 addPetBond）。
export const PET_BOND_MAX = 100;
export const PET_BOND_STAGES = [
  { stage: 0, min: 0,  name: '初見' },
  { stage: 1, min: 34, name: '漸熟' },
  { stage: 2, min: 67, name: '知己' },
];

const PET_BY_ID = new Map(PETS.map((p) => [p.id, p]));
const EQUIP_BY_ID = new Map(PET_EQUIP.map((e) => [e.id, e]));

function ensurePetState(meta) {
  if (!meta.pet) {
    meta.pet = {
      seen: {}, active: null, ownedEquip: [], equipped: {}, nicknames: {},
      bond: {}, unlockedAt: {}, badges: {}, equipLevel: {}, subActive: null,
    };
  }
  const s = meta.pet;
  if (!s.seen) s.seen = {};
  if (!s.ownedEquip) s.ownedEquip = [];
  if (!s.equipped) s.equipped = {};
  if (!s.nicknames) s.nicknames = {};
  if (!s.bond) s.bond = {};
  if (!s.unlockedAt) s.unlockedAt = {};
  if (!s.badges) s.badges = {};
  if (!s.equipLevel) s.equipLevel = {};
  if (s.subActive === undefined) s.subActive = null;
  return s;
}

// 寵物暱稱：孩子幫神獸取名（1–8 字）；空字串＝清除、回本名。
export const NICKNAME_MAX = 8;

export function setPetNickname(meta, petId, nickname) {
  const s = ensurePetState(meta);
  if (!PET_BY_ID.has(petId)) return { meta, ok: false, reason: 'not-found' };
  if (!isUnlocked(meta, petId)) return { meta, ok: false, reason: 'locked' };
  const nick = String(nickname).trim();
  if (nick.length === 0) {
    delete s.nicknames[petId];
    return { meta, ok: true, reason: null };
  }
  if (nick.length > NICKNAME_MAX) return { meta, ok: false, reason: 'too-long' };
  s.nicknames[petId] = nick;
  return { meta, ok: true, reason: null };
}

// 某類別的精通題數（已煉成字珠）。字音＝zy- 前綴、成語＝cy- 前綴、混合＝全部。
// 曾答錯過（wrong > 0）才煉成的題，貢獻加權 WRONG_MASTERY_WEIGHT 倍——弱點題經驗值加權。
export function categoryMastery(meta, category) {
  let n = 0;
  for (const [id, r] of Object.entries(meta.collection || {})) {
    if (!r || !r.earnedAt) continue;
    const weight = r.wrong > 0 ? WRONG_MASTERY_WEIGHT : 1;
    if (category === '混合') { n += weight; continue; }
    if (category === '字音' && id.startsWith('zy-')) n += weight;
    else if (category === '成語' && id.startsWith('cy-')) n += weight;
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

// 寵物閣列表：含解鎖狀態、等級、精通數、下一級門檻、羈絆階段、徽章數。
export function listPets(meta) {
  const s = ensurePetState(meta);
  return PETS.map((p) => {
    const mastery = categoryMastery(meta, p.category);
    const level = Math.min(MAX_LEVEL, Math.floor(mastery / LEVEL_STEP));
    const nextAt = level >= MAX_LEVEL ? null : (level + 1) * LEVEL_STEP;
    const nickname = s.nicknames[p.id] || null;
    const bondStage = getPetBondStage(meta, p.id);
    return {
      id: p.id, name: p.name, category: p.category, desc: p.desc,
      nickname, displayName: nickname || p.name,
      unlocked: mastery >= p.unlockAt, unlockAt: p.unlockAt,
      mastery: Math.round(mastery), level, nextAt,
      active: s.active === p.id,
      isSub: s.subActive === p.id,
      equipped: (s.equipped[p.id] || []).slice(),
      bond: s.bond[p.id] || 0,
      bondStage: bondStage.stage,
      bondStageName: bondStage.name,
      line: p.lines[bondStage.stage],
      unlockedAt: s.unlockedAt[p.id] || null,
      badges: (s.badges[p.id] || []).slice(),
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
      if (!s.unlockedAt[p.id]) s.unlockedAt[p.id] = new Date().toISOString();
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
  if (s.subActive === petId) s.subActive = null;
  return { meta, ok: true, reason: null };
}

// 副寵（P2）：出戰主寵之外，再選一隻給小額被動加成，見 getPetBattleMods。
export function setSubPet(meta, petId) {
  const s = ensurePetState(meta);
  if (!PET_BY_ID.has(petId)) return { meta, ok: false, reason: 'not-found' };
  if (!isUnlocked(meta, petId)) return { meta, ok: false, reason: 'locked' };
  if (s.active === petId) return { meta, ok: false, reason: 'is-active' };
  s.subActive = petId;
  return { meta, ok: true, reason: null };
}

export function clearSubPet(meta) {
  const s = ensurePetState(meta);
  s.subActive = null;
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
  s.equipLevel[equipId] = 1;
  return { meta, ok: true, reason: null };
}

// 裝備分級升級：Lv.1→2→3，各級需字珠＋任一類別精通門檻（見 PET_EQUIP.upgradeCost/upgradeGate）。
export function upgradeEquip(meta, equipId) {
  const s = ensurePetState(meta);
  const item = EQUIP_BY_ID.get(equipId);
  if (!item) return { meta, ok: false, reason: 'not-found' };
  if (!s.ownedEquip.includes(equipId)) return { meta, ok: false, reason: 'not-owned' };
  const level = s.equipLevel[equipId] || 1;
  if (level >= EQUIP_MAX_LEVEL) return { meta, ok: false, reason: 'max-level' };
  const gate = item.upgradeGate[level - 1];
  const best = Math.max(categoryMastery(meta, '字音'), categoryMastery(meta, '成語'), categoryMastery(meta, '混合'));
  if (best < gate) return { meta, ok: false, reason: 'gate' };
  const cost = item.upgradeCost[level - 1];
  const paid = spendPearls(meta, cost, `pet-equip-upgrade:${equipId}`);
  if (!paid.ok) return { meta, ok: false, reason: 'pearls' };
  s.equipLevel[equipId] = level + 1;
  return { meta, ok: true, reason: null };
}

export function getEquipLevel(meta, equipId) {
  const s = ensurePetState(meta);
  return s.equipLevel[equipId] || 1;
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
// 主寵被動：每級 +1 傷害。設備：各自 effect 依分級倍率疊加。副寵：小額被動加成，封頂 +3。
export function getPetBattleMods(meta) {
  const s = ensurePetState(meta);
  const mods = { damageBonus: 0, freeEliminate: 0 };
  const petId = s.active;
  if (!petId || !isUnlocked(meta, petId)) return mods;
  mods.damageBonus += petLevel(meta, petId);
  for (const equipId of s.equipped[petId] || []) {
    const item = EQUIP_BY_ID.get(equipId);
    if (!item) continue;
    const mult = EQUIP_LEVEL_MULT[s.equipLevel[equipId] || 1];
    if (item.effect.damageBonus) mods.damageBonus += Math.round(item.effect.damageBonus * mult);
    if (item.effect.freeEliminate) mods.freeEliminate += Math.round(item.effect.freeEliminate * mult);
  }
  if (s.subActive && isUnlocked(meta, s.subActive)) {
    mods.damageBonus += Math.min(3, Math.floor(petLevel(meta, s.subActive) / 2));
  }
  return mods;
}

// 羈絆值：脫鉤於類別精通等級，答對時累加（見 kernel.js processAnswer）。與 js/meta/bond.js 的
// 「墨靈」羈絆（meta.bond）是不同的兩套資料，切勿混淆。
function stageOfBond(value) {
  let idx = 0;
  for (const st of PET_BOND_STAGES) if (value >= st.min) idx = st.stage;
  return idx;
}

export function addPetBond(meta, petId, amount) {
  const s = ensurePetState(meta);
  if (!PET_BY_ID.has(petId)) return { meta, stageUp: false };
  const before = s.bond[petId] || 0;
  const stageBefore = stageOfBond(before);
  const after = Math.min(PET_BOND_MAX, before + amount);
  s.bond[petId] = after;
  const stageAfter = stageOfBond(after);
  return { meta, stageUp: stageAfter > stageBefore };
}

export function getPetBondStage(meta, petId) {
  const s = ensurePetState(meta);
  const value = s.bond[petId] || 0;
  const idx = stageOfBond(value);
  return { value, stage: idx, name: PET_BOND_STAGES[idx].name };
}

// 燈籠里程碑（js/meta/daily.js LANTERN_MILESTONES）觸發時，當下出戰的寵物獲得一枚永久徽章。
// 無出戰寵物時 no-op；重複 tier 不重複記錄。
export function awardPetBadge(meta, tier) {
  const s = ensurePetState(meta);
  const petId = s.active;
  if (!petId) return { meta, awarded: false };
  const list = s.badges[petId] || (s.badges[petId] = []);
  if (list.includes(tier)) return { meta, awarded: false };
  list.push(tier);
  return { meta, awarded: true };
}
