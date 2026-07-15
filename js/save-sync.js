// 跨裝置存檔同步：分數用 naicheng-counter 共用 Upstash 後端。斷線一律靜默回 {ok:false}，
// 絕不擋本機遊玩；code 是隨機存取金鑰，非帳號密碼。

const BASE = 'https://naicheng-counter.vercel.app';
const SITE = 'zizizhuji';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆的 0/O/1/I

export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
}

export async function pushSave(code, meta) {
  try {
    const r = await fetch(`${BASE}/api/save-put?site=${SITE}&code=${code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: meta, updatedAt: Date.now() }),
    });
    return r.ok ? { ok: true } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function pullSave(code) {
  try {
    const r = await fetch(`${BASE}/api/save-get?site=${SITE}&code=${encodeURIComponent(code)}`);
    if (!r.ok) return { ok: false };
    const d = await r.json();
    return { ok: true, data: d.data, updatedAt: d.updatedAt };
  } catch {
    return { ok: false };
  }
}
