// M0 store — 單一 namespace `zzj_meta` 的載入/儲存/版本遷移。
// 所有機制模組唯一的持久化出入口；全包 try/catch，隱私模式不炸。
// 測試可用 setStorageBackend() 注入 mock storage。

export const META_KEY = 'zzj_meta';
export const SCHEMA_VERSION = 1;

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: k => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: k => { map.delete(k); },
  };
}

let injectedBackend = null;
const memoryFallback = createMemoryStorage();

export function setStorageBackend(backend) {
  injectedBackend = backend;
}

function backend() {
  if (injectedBackend) return injectedBackend;
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch { /* 隱私模式存取 localStorage 本身就可能 throw */ }
  return memoryFallback;
}

export function defaultMeta() {
  return {
    v: SCHEMA_VERSION,
    profile: { name: '', createdAt: '' },
    oath: { oathId: null, swornAt: '', storySeen: false, renewCount: 0 },
    world: { purified: [], byZone: { yin: 0, xing: 0, chengyu: 0 }, milestonesSeen: [] },
    leitner: {},
    collection: {},
    pearls: { balance: 0, earnedToday: 0, earnedDate: '' },
    xp: { value: 0, rank: 0, totalAnswered: 0, totalCorrect: 0 },
    ach: {
      unlocked: {},
      stats: {
        wins: 0, battles: 0, bestCombo: 0, perfectGames: 0,
        totalAnswered: 0, totalCorrect: 0, lanternBest: 0,
        forgedCount: 0, forgedZiyin: 0, forgedChengyu: 0,
      },
    },
    gear: { owned: [], loadout: [] },
    arts: { unlocked: [], equipped: null, battlesWon: 0 },
    daily: {
      date: '', todayCorrect: 0, streak: 0, best: 0, tier: 0, boxOpened: false,
      lastLit: '', weekKey: '', weekOpenDays: [], liuliOpened: false,
      charms: 0, milestonesClaimed: [],
    },
    bond: { value: 0, lastDailyBonus: '', giftsClaimed: [] },
    encounter: { sinceLast: 0, lastEventId: null, totalCount: 0 },
    arena: { week: '', entries: [], history: [] },
    challenges: [],
    pet: { seen: {}, active: null, ownedEquip: [], equipped: {} },
    // 閃卡 Leitner 盒位；積分競技各庫最高分；班級排行榜代碼與暱稱
    selfstudy: { flash: {}, scoreBest: {}, classCode: '', nick: '' },
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// 以 defaults 為底、stored 覆蓋；缺欄位自動補齊（版本遷移的最低保證）。
function mergeInto(def, stored) {
  const out = { ...def };
  for (const key of Object.keys(stored)) {
    if (isPlainObject(def[key]) && isPlainObject(stored[key])) {
      out[key] = mergeInto(def[key], stored[key]);
    } else {
      out[key] = stored[key];
    }
  }
  return out;
}

export function loadMeta() {
  const def = defaultMeta();
  try {
    const raw = backend().getItem(META_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return def;
    const merged = mergeInto(def, parsed);
    merged.v = SCHEMA_VERSION;
    return merged;
  } catch {
    return def;
  }
}

export function saveMeta(meta) {
  try {
    backend().setItem(META_KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function resetAll() {
  try {
    backend().removeItem(META_KEY);
  } catch { /* ignore */ }
}
