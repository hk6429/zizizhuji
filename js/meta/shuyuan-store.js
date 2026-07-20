// 字靈書院純邏輯層：書院擺設/樣式/匾額/慶典狀態（自有 key zz_shuyuan）。
// 山門/院落/裝飾數量一律由 zzj_meta 唯讀 derive，本模組絕不寫回 zzj_meta。零 DOM。

export const SHUYUAN_KEY = 'zz_shuyuan';
export const SHUYUAN_VERSION = 1;

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
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

export function defaultShuyuan() {
  return {
    v: SHUYUAN_VERSION,
    seeded: false,      // 首次開院時把「既有進度」靜默標記為已慶祝，避免慶典洪水
    placements: {},     // { decorId: { x, y } } 百分比座標（相對場景，0–100）
    styles: {},         // { kind: styleIdx }
    plaques: {},        // { targetId: [charId, ...] } 詞庫選字組成的匾額
    couplet: null,      // COUPLET_BANK 的 id
    celebrated: [],     // ['rank-3', 'pet-baize', ...] 已放過慶典的事件
  };
}

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

export function loadShuyuan() {
  const def = defaultShuyuan();
  try {
    const raw = backend().getItem(SHUYUAN_KEY);
    if (!raw) return def;
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) return def;
    const merged = { ...def, ...parsed };
    merged.v = SHUYUAN_VERSION;
    return merged;
  } catch {
    return def;
  }
}

export function saveShuyuan(state) {
  try {
    backend().setItem(SHUYUAN_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
