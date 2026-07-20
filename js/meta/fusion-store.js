// 神獸融合系統邏輯層：墨晶貨幣／融合資格／融合核心／稱號被動／配方揭曉／稚靈出戰與名片。
// 純函式操作 meta（zzj_meta 的 meta.fusion），不碰 DOM、不呼叫 saveMeta——存檔由呼叫端負責。
// 敘事定位：融合＝修復被濁墨吞噬的神獸血脈（接 js/meta/bond.js 的濁墨世界觀）。
// 硬性規則（vocab-duel P3-11 教訓）：雙親永不消耗；失敗只扣墨晶（白帽時間成本，不扣資產）。

import { PETS, petLevel, MAX_LEVEL } from './pet.js';

export const CRYSTAL_DAILY_CAP = 10; // 墨晶每日取得上限

export function ensureFusionState(meta) {
  if (!meta.fusion) {
    meta.fusion = {
      crystals: { balance: 0, earnedToday: 0, earnedDate: '' },
      cubs: {}, revealed: {}, riddleTried: {}, activeCub: null,
    };
  }
  const s = meta.fusion;
  if (!s.crystals) s.crystals = { balance: 0, earnedToday: 0, earnedDate: '' };
  if (!s.cubs) s.cubs = {};
  if (!s.revealed) s.revealed = {};
  if (!s.riddleTried) s.riddleTried = {};
  if (s.activeCub === undefined) s.activeCub = null;
  return s;
}

// 墨晶入帳：仿 economy.js earnPearls 的每日上限邏輯，但墨晶無豁免來源。
export function earnCrystals(meta, amount, today = '') {
  const s = ensureFusionState(meta);
  if (!Number.isFinite(amount) || amount <= 0) return { meta, earned: 0, capped: false };
  const c = s.crystals;
  if (today && c.earnedDate !== today) {
    c.earnedDate = today;
    c.earnedToday = 0;
  }
  let earned = Math.floor(amount);
  let capped = false;
  const room = Math.max(0, CRYSTAL_DAILY_CAP - c.earnedToday);
  if (earned > room) { earned = room; capped = true; }
  c.earnedToday += earned;
  c.balance += earned;
  return { meta, earned, capped };
}

export function spendCrystals(meta, amount) {
  const s = ensureFusionState(meta);
  if (!Number.isFinite(amount) || amount < 0) return { meta, ok: false };
  if (s.crystals.balance < amount) return { meta, ok: false };
  s.crystals.balance -= amount;
  return { meta, ok: true };
}

export function getCrystalBalance(meta) {
  return ensureFusionState(meta).crystals.balance;
}

// —— 融合資格判定：同類別雙親皆滿級（Lv15）＋類別正確率達門檻 ——

export const ACCURACY_GATE = 0.8;      // 類別近期正確率門檻
export const ACCURACY_MIN_SAMPLE = 20; // 樣本數不足不放行，避免 3 題 100% 就過關

const PET_BY_ID = new Map(PETS.map((p) => [p.id, p]));

// 類別 → weakness.js 弱點分類（與 pet-ui.js petCategoryTypes 同邏輯；那邊是私有函式，這裡自持一份）
export function categoryWeakTypes(category) {
  if (category === '字音') return ['字音', '字形'];
  if (category === '成語') return ['意義', '近似成語', '錯別字'];
  return ['字音', '字形', '意義', '近似成語', '錯別字'];
}

// 以 meta.weak 累計紀錄近似「近期正確率」：彙總該類別對應弱點分類的 correct/wrong。
export function categoryAccuracy(meta, category) {
  const weak = (meta && meta.weak) || {};
  let correct = 0, total = 0;
  for (const type of categoryWeakTypes(category)) {
    const w = weak[type];
    if (!w) continue;
    correct += w.correct;
    total += w.correct + w.wrong;
  }
  return { accuracy: total > 0 ? correct / total : 0, total };
}

export function getEligibility(meta, category) {
  const maxLevelPets = PETS
    .filter((p) => p.category === category && petLevel(meta, p) >= MAX_LEVEL)
    .map((p) => p.id);
  const { accuracy, total } = categoryAccuracy(meta, category);
  const reasons = {
    pair: maxLevelPets.length >= 2,
    accuracy: total >= ACCURACY_MIN_SAMPLE && accuracy >= ACCURACY_GATE,
  };
  return { eligible: reasons.pair && reasons.accuracy, maxLevelPets, accuracy, total, reasons };
}

export function canFusePair(meta, petIdA, petIdB) {
  if (petIdA === petIdB) return { ok: false, reason: 'same-pet' };
  const a = PET_BY_ID.get(petIdA);
  const b = PET_BY_ID.get(petIdB);
  if (!a || !b) return { ok: false, reason: 'not-found' };
  if (a.category !== b.category) return { ok: false, reason: 'category-mismatch' };
  if (petLevel(meta, a) < MAX_LEVEL || petLevel(meta, b) < MAX_LEVEL) return { ok: false, reason: 'level' };
  const e = getEligibility(meta, a.category);
  if (!e.reasons.accuracy) return { ok: false, reason: 'accuracy' };
  return { ok: true, reason: null };
}

// —— 融合核心：成功路徑出稚靈，雙親永不消耗 ——

export const FUSE_COST = 30;  // 一次融合 30 墨晶（＝攻克 30 題弱點、至少 3 天積累）
export const FAIL_RATE = 0.2; // 20% 失敗率——失敗只損墨晶（時間成本），見 Task 4

// 稚靈全庫：山海經幼獸，每類別 2 隻依 order 出庫。
// bornLine 扣連 bond.js 濁墨世界觀：融合＝修復被濁墨吞噬的神獸血脈。
export const CUBS = [
  { id: 'tiangou', name: '天狗', category: '字音', order: 1,
    titles: ['吠月童子', '守夜小尉', '辨聲小靈'],
    desc: '狀如狸而白首的守夜幼獸，吠聲能辨天下之音。',
    bornLine: '一聲清吠破開濁墨——被吞噬的辨音血脈，在你手中重新接上了。' },
  { id: 'zhujian', name: '諸犍', category: '字音', order: 2,
    titles: ['聽風小豹', '留聲小史'],
    desc: '人面豹身的幼獸，善聽善記，過耳之音永不忘。',
    bornLine: '牠豎起耳朵聽見了你答對的每一題——諸犍的血脈，從濁墨裡被你喚醒了。' },
  { id: 'hundun', name: '混沌', category: '成語', order: 1,
    titles: ['渾沌小初', '無面小仙', '歌舞小童'],
    desc: '渾敦無面目而識歌舞，是一切典故最初的模樣。',
    bornLine: '濁墨散去，混沌睜開了不存在的眼睛——典故之源的血脈，由你修復。' },
  { id: 'xiezhi', name: '獬豸', category: '成語', order: 2,
    titles: ['辨言小判', '正字小御'],
    desc: '獨角神羊之幼，能辨是非曲直，錯別字無所遁形。',
    bornLine: '小小的獨角頂開了濁墨——辨正之獸的血脈，因你的成語功底而重生。' },
  { id: 'zhuyin', name: '燭陰', category: '混合', order: 1,
    titles: ['燭夜小龍', '晝夜小衡', '照幽小靈'],
    desc: '燭九陰之幼龍，睜眼為晝、閉眼為夜，照徹墨界幽暗。',
    bornLine: '幼龍睜眼的一瞬，墨界亮了——燭陰的血脈穿過濁墨，回到了人間。' },
  { id: 'jingwei', name: '精衛', category: '混合', order: 2,
    titles: ['填海小衛', '不悔小羽'],
    desc: '銜木石以填滄海的幼鳥，一題一石，永不言棄。',
    bornLine: '牠銜著第一顆小石落在你肩上——精衛不悔的血脈，被你的堅持修復了。' },
];

const CUB_BY_ID = new Map(CUBS.map((c) => [c.id, c]));

export function nextCubFor(meta, category) {
  const s = ensureFusionState(meta);
  const pool = CUBS.filter((c) => c.category === category).sort((a, b) => a.order - b.order);
  return pool.find((c) => !s.cubs[c.id]) || null;
}

export function fuse(meta, petIdA, petIdB, { rng = Math.random, today = '' } = {}) {
  const s = ensureFusionState(meta);
  const gate = canFusePair(meta, petIdA, petIdB);
  if (!gate.ok) return { meta, ok: false, reason: gate.reason };
  const category = PET_BY_ID.get(petIdA).category;
  const cubDef = nextCubFor(meta, category);
  if (!cubDef) return { meta, ok: false, reason: 'all-owned' };
  const paid = spendCrystals(meta, FUSE_COST);
  if (!paid.ok) return { meta, ok: false, reason: 'crystals' };
  // （Task 4 在此插入失敗分支）
  const title = cubDef.titles[Math.floor(rng() * cubDef.titles.length)];
  s.cubs[cubDef.id] = {
    bornAt: new Date().toISOString(),
    parents: [petIdA, petIdB],
    title, passive: null, nickname: null,
  };
  return {
    meta, ok: true, result: 'success',
    cub: { id: cubDef.id, name: cubDef.name, category, title, bornLine: cubDef.bornLine, parents: [petIdA, petIdB] },
  };
}

export function listCubs(meta) {
  const s = ensureFusionState(meta);
  return CUBS.filter((c) => s.cubs[c.id]).map((c) => {
    const r = s.cubs[c.id];
    return {
      id: c.id, name: c.name, category: c.category, desc: c.desc,
      title: r.title, nickname: r.nickname, displayName: r.nickname || c.name,
      passive: r.passive, parents: r.parents.slice(), bornAt: r.bornAt,
      isActive: s.activeCub === c.id,
    };
  });
}
