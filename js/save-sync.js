// 跨裝置存檔同步：改用 zizizhuji 自己 Cloudflare Pages Functions + D1（naicheng-counter
// 共用 Upstash 已額度爆量、GET/PUT 全面 500；D1 免費層每天約 500 萬次讀取/10 萬次寫入，
// 不再依賴其他 13 站共用的脆弱後端）。
// 斷線一律靜默回 {ok:false}，絕不擋本機遊玩；code 是隨機存取金鑰，非帳號密碼。

const BASE = 'https://zizizhuji.pages.dev';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 排除易混淆的 0/O/1/I

// 6 碼中保證有一組重複字元（好記），其餘 5 碼獨立亂數（32^5≈3360 萬組合，碰撞機率仍極低）。
export function generateCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  const chars = Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]);
  const dupChar = chars[bytes[4] % chars.length];
  const insertAt = crypto.getRandomValues(new Uint8Array(1))[0] % (chars.length + 1);
  chars.splice(insertAt, 0, dupChar);
  return chars.join('');
}

export async function pushSave(code, meta) {
  try {
    const r = await fetch(`${BASE}/api/save-put?code=${code}`, {
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
    const r = await fetch(`${BASE}/api/save-get?code=${encodeURIComponent(code)}`);
    if (!r.ok) return { ok: false };
    const d = await r.json();
    return { ok: true, data: d.data, updatedAt: d.updatedAt };
  } catch {
    return { ok: false };
  }
}
