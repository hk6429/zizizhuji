// 字靈書院純邏輯層：書院擺設/樣式/匾額/慶典狀態（自有 key zz_shuyuan）。
// 山門/院落/裝飾數量一律由 zzj_meta 唯讀 derive，本模組絕不寫回 zzj_meta。零 DOM。

import { RANKS } from './progress.js';
import * as world from './world.js';
import { getCollection } from './collection.js';

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

// ── 字珠實體化：品階顆數 → 庭園裝飾件數（有上限，避免撐爆畫面） ──
export const DECOR_KINDS = {
  path:    { name: '白珠鋪路',     grade: 0, per: 10, cap: 12, styles: ['卵石徑', '月牙磚', '流水紋'] },
  lantern: { name: '青珠燈籠',     grade: 1, per: 5,  cap: 10, styles: ['竹骨紗燈', '荷花宮燈', '螢石吊燈'] },
  koi:     { name: '金珠錦鯉盆栽', grade: 2, per: 3,  cap: 8,  styles: ['青瓷錦鯉缸', '古松盆景', '金鱗小池'] },
  statue:  { name: '墨玉神獸雕像', grade: 3, per: 1,  cap: 12, styles: ['墨玉圓雕', '青銅古鑄', '潑墨石刻'] },
};

export function styleIndexOf(state, kind) {
  const def = DECOR_KINDS[kind];
  const idx = state.styles[kind];
  return def && Number.isInteger(idx) && idx >= 0 && idx < def.styles.length ? idx : 0;
}

export function setDecorStyle(state, kind, styleIdx) {
  const def = DECOR_KINDS[kind];
  if (!def) return { ok: false, msg: '沒有這種裝飾' };
  if (!Number.isInteger(styleIdx) || styleIdx < 0 || styleIdx >= def.styles.length) {
    return { ok: false, msg: '沒有這個樣式' };
  }
  state.styles[kind] = styleIdx;
  return { ok: true };
}

export function getDecorations(meta, state) {
  const { counts } = getCollection(meta);
  const out = [];
  for (const [kind, def] of Object.entries(DECOR_KINDS)) {
    const n = Math.min(def.cap, Math.floor((counts[def.grade] || 0) / def.per));
    const styleIdx = styleIndexOf(state, kind);
    for (let i = 0; i < n; i++) {
      const id = `${kind}-${i}`;
      const pos = state.placements[id] || { x: 50, y: 50 }; // Task 4 換成 defaultPos(kind, i)
      out.push({
        id, kind, name: def.name, styleIdx, styleName: def.styles[styleIdx],
        x: pos.x, y: pos.y, custom: !!state.placements[id],
      });
    }
  }
  return out;
}
