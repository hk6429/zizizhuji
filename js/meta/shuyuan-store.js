// 字靈書院純邏輯層：書院擺設/樣式/匾額/慶典狀態（自有 key zz_shuyuan）。
// 山門/院落/裝飾數量一律由 zzj_meta 唯讀 derive，本模組絕不寫回 zzj_meta。零 DOM。

import { RANKS } from './progress.js';
import * as world from './world.js';

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

// ── 山門十階：文氣境界（蒙童→文曲星）直接對應山門型態 ──
export function getGateStage(meta) {
  const stage = Math.max(0, Math.min(RANKS.length - 1, meta.xp.rank | 0));
  return { stage, rankName: RANKS[stage].name, total: RANKS.length };
}

// ── 三院落：直讀 world.js byZone 進度百分比，換算繁茂度五級 ──
export const COURTYARDS = [
  { id: 'yin', name: '谷音亭', zoneName: '字音谷' },
  { id: 'xing', name: '墨林軒', zoneName: '字形林' },
  { id: 'chengyu', name: '珠璣閣', zoneName: '珠璣海' },
];

export const FLOURISH_TIERS = ['荒蕪', '初萌', '漸盛', '繁茂', '鼎盛'];
const FLOURISH_AT = [0, 10, 30, 60, 100]; // 對齊 world.js 里程碑百分比

export function flourishTier(pct) {
  let tier = 0;
  for (let i = 1; i < FLOURISH_AT.length; i++) {
    if (pct >= FLOURISH_AT[i]) tier = i;
  }
  return tier;
}

export function getCourtyards(meta, totals) {
  const { byZone } = world.getProgress(meta, totals);
  return COURTYARDS.map((c) => {
    const z = byZone[c.id];
    const tier = flourishTier(z.pct);
    return { ...c, done: z.done, total: z.total, pct: z.pct, tier, tierName: FLOURISH_TIERS[tier] };
  });
}
