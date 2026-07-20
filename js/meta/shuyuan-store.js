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

// ── 自由擺放：預設散佈（確定性）＋自訂座標（百分比 2–98） ──
const clampPct = (v) => Math.max(2, Math.min(98, v));

// 分帶散佈：path 沿中軸石徑、lantern 左側坡、koi 右前水岸、statue 後山列陣
const DEFAULT_BANDS = {
  path:    { x0: 44, y0: 90, dx: 1.6,  dy: -6.5 },
  lantern: { x0: 12, y0: 78, dx: 6.5,  dy: -4 },
  koi:     { x0: 62, y0: 84, dx: 4.5,  dy: -5 },
  statue:  { x0: 10, y0: 26, dx: 7.2,  dy: 2.5 },
};

export function defaultPos(kind, i) {
  const b = DEFAULT_BANDS[kind] || DEFAULT_BANDS.path;
  return { x: clampPct(b.x0 + b.dx * i), y: clampPct(b.y0 + b.dy * (i % 8)) };
}

export function placeDecoration(state, decorId, x, y) {
  const sep = typeof decorId === 'string' ? decorId.lastIndexOf('-') : -1;
  const kind = sep > 0 ? decorId.slice(0, sep) : '';
  if (!DECOR_KINDS[kind]) return { ok: false, msg: '沒有這個裝飾' };
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, msg: '座標無效' };
  state.placements[decorId] = { x: clampPct(x), y: clampPct(y) };
  return { ok: true };
}

export function resetPlacements(state) {
  state.placements = {};
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
      const pos = state.placements[id] || defaultPos(kind, i);
      out.push({
        id, kind, name: def.name, styleIdx, styleName: def.styles[styleIdx],
        x: pos.x, y: pos.y, custom: !!state.placements[id],
      });
    }
  }
  return out;
}

// ── 題匾額／對聯：詞庫選字組合，不開放自由輸入（國中小使用情境，杜絕不當字詞） ──
export const PLAQUE_TARGETS = ['gate', 'yin', 'xing', 'chengyu'];
const DEFAULT_PLAQUES = { gate: '字靈書院', yin: '谷音亭', xing: '墨林軒', chengyu: '珠璣閣' };

export const PLAQUE_BANK = [
  { id: 'wen', ch: '文' }, { id: 'qi', ch: '氣' }, { id: 'zhu', ch: '珠' }, { id: 'ji', ch: '璣' },
  { id: 'mo', ch: '墨' }, { id: 'guang', ch: '光' }, { id: 'shu', ch: '書' }, { id: 'xiang', ch: '香' },
  { id: 'gu', ch: '谷' }, { id: 'yin', ch: '音' }, { id: 'lin', ch: '林' }, { id: 'hai', ch: '海' },
  { id: 'yun', ch: '雲' }, { id: 'shan', ch: '山' }, { id: 'feng', ch: '風' }, { id: 'yue', ch: '月' },
  { id: 'xing', ch: '星' }, { id: 'yan', ch: '硯' }, { id: 'bi', ch: '筆' }, { id: 'shi', ch: '詩' },
  { id: 'li', ch: '禮' }, { id: 'xian', ch: '賢' }, { id: 'xin', ch: '心' }, { id: 'zhi', ch: '志' },
];
export const PLAQUE_MIN = 2;
export const PLAQUE_MAX = 4;
const PLAQUE_CH = new Map(PLAQUE_BANK.map((c) => [c.id, c.ch]));

export function setPlaque(state, targetId, charIds) {
  if (!PLAQUE_TARGETS.includes(targetId)) return { ok: false, msg: '沒有這個匾額位置' };
  if (!Array.isArray(charIds) || charIds.length < PLAQUE_MIN || charIds.length > PLAQUE_MAX) {
    return { ok: false, msg: `匾額要 ${PLAQUE_MIN}–${PLAQUE_MAX} 個字` };
  }
  if (!charIds.every((id) => PLAQUE_CH.has(id))) return { ok: false, msg: '只能從詞庫選字' };
  state.plaques[targetId] = charIds.slice();
  return { ok: true };
}

export function getPlaqueText(state, targetId) {
  const ids = state.plaques[targetId];
  if (!ids || !ids.length) return DEFAULT_PLAQUES[targetId] || '';
  return ids.map((id) => PLAQUE_CH.get(id) || '').join('');
}

export const COUPLET_BANK = [
  { id: 'c1', up: '一字一珠光照海', down: '半書半墨氣成虹' },
  { id: 'c2', up: '谷音繞樑傳雅韻', down: '林字生輝映月明' },
  { id: 'c3', up: '筆下有神驅濁墨', down: '胸中藏典煉真珠' },
  { id: 'c4', up: '守燈夜夜心如鏡', down: '拾珠字字步成蹊' },
];
const COUPLET_BY_ID = new Map(COUPLET_BANK.map((c) => [c.id, c]));

export function setCouplet(state, coupletId) {
  if (coupletId === null) { state.couplet = null; return { ok: true }; }
  if (!COUPLET_BY_ID.has(coupletId)) return { ok: false, msg: '沒有這副對聯' };
  state.couplet = coupletId;
  return { ok: true };
}

export function getCouplet(state) {
  return state.couplet ? COUPLET_BY_ID.get(state.couplet) : null;
}
