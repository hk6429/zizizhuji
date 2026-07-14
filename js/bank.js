// 題庫載入與快取的單一出入口，app.js 與自學／積分競技各 UI 共用同一份快取。
import { loadQuizBank } from './quiz-loader.js';

export const BANK_SOURCES = {
  ziyin:   [{ path: 'data/ziyin-zixing-elementary.json', kind: 'ziyin' }],
  chengyu: [{ path: 'data/chengyu-elementary.json', kind: 'chengyu' }],
  mixed: [
    { path: 'data/ziyin-zixing-elementary.json', kind: 'ziyin' },
    { path: 'data/chengyu-elementary.json', kind: 'chengyu' },
  ],
};

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
    BANK_SOURCES[bankKey].map((src) => fetchBank(src.path, src.kind)),
  );
  return parts.flat();
}
