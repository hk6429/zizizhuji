// 題庫載入與快取的單一出入口，app.js 與自學／積分競技各 UI 共用同一份快取。
import { loadQuizBank } from './quiz-loader.js';

export const BANK_SOURCES = {
  國小: {
    ziyin:   [{ path: 'data/ziyin-zixing-elementary.json', kind: 'ziyin' }],
    chengyu: [{ path: 'data/chengyu-elementary.json', kind: 'chengyu' }],
    mixed: [
      { path: 'data/ziyin-zixing-elementary.json', kind: 'ziyin' },
      { path: 'data/chengyu-elementary.json', kind: 'chengyu' },
    ],
  },
  國中: {
    ziyin:   [{ path: 'data/ziyin-zixing-junior.json', kind: 'ziyin' }],
    chengyu: [{ path: 'data/chengyu-junior.json', kind: 'chengyu' }],
    mixed: [
      { path: 'data/ziyin-zixing-junior.json', kind: 'ziyin' },
      { path: 'data/chengyu-junior.json', kind: 'chengyu' },
    ],
  },
};

// 學制是裝置層級設定（比照 zizhu:saveCode 先例），不進 zzj_meta schema。
const LEVEL_KEY = 'zizhu:level';
let storedLevel = null;
try { storedLevel = localStorage.getItem(LEVEL_KEY); } catch {}
let currentLevel = BANK_SOURCES[storedLevel] ? storedLevel : '國小';

export function getLevel() { return currentLevel; }

export function setLevel(level) {
  if (!BANK_SOURCES[level] || level === currentLevel) return false;
  currentLevel = level;
  try { localStorage.setItem(LEVEL_KEY, level); } catch {}
  return true;
}

const cache = new Map(); // path → usable[]

export async function fetchBank(path, kind) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(path);
  const raw = await res.json();
  const { usable, rejected } = loadQuizBank(raw, kind);
  if (rejected.length) {
    console.warn(`[字字珠璣] ${path} 有 ${rejected.length} 筆題目未通過驗證，已排除`, rejected);
  }
  cache.set(path, usable);
  return usable;
}

export async function loadBank(bankKey) {
  const parts = await Promise.all(
    BANK_SOURCES[currentLevel][bankKey].map((src) => fetchBank(src.path, src.kind)),
  );
  return parts.flat();
}
