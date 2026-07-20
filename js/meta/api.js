// 跨子系統共用 API helper（即時對戰/融合/市場一律經此呼叫後端）。
// 後端只在 Cloudflare Pages 一個平台；鏡像站（vercel.app / netlify.app）打絕對網址。
// ⛔ 禁止任何模組繞過本檔直接 fetch('api/...') 相對路徑——vocab-duel 踩過的三平台地雷。
export const API_ORIGIN = 'https://zizizhuji.pages.dev';
const SAME_ORIGIN_HOSTS = new Set(['zizizhuji.pages.dev', 'localhost', '127.0.0.1']);

export function apiBase(hostname) {
  return SAME_ORIGIN_HOSTS.has(hostname) ? '' : API_ORIGIN;
}

export function createApi({ fetchFn, hostname } = {}) {
  const doFetch = fetchFn ?? ((...a) => fetch(...a));
  const host = () => hostname ?? location.hostname;
  return {
    base() { return apiBase(host()); },
    async call(path, { method = 'POST', body } = {}) {
      if (typeof path !== 'string' || !path.startsWith('/api/')) {
        throw new TypeError(`ZZAPI.call path 必須以 /api/ 開頭：${path}`);
      }
      const opts = { method };
      if (body !== undefined) {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body = JSON.stringify(body);
      }
      try {
        const r = await doFetch(apiBase(host()) + path, opts);
        return await r.json();
      } catch {
        return null; // 離線/網路失敗：呼叫端顯示降級畫面
      }
    },
  };
}

export const ZZAPI = createApi();
if (typeof window !== 'undefined') window.ZZAPI = ZZAPI;
