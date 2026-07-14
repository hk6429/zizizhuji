// 班級共享排行榜（M3，非即時）：分數上傳到 naicheng-counter 的 Upstash。
// 後端斷線一律靜默回 {ok:false}，絕不擋積分競技本體遊玩。

const BASE = 'https://naicheng-counter.vercel.app';
const SITE = 'zizizhuji';

export async function submitScore(board, name, score) {
  try {
    const r = await fetch(`${BASE}/api/lb-submit?site=${SITE}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board, name, score }),
    });
    if (!r.ok) return { ok: false };
    const d = await r.json();
    return { ok: true, top: d.top || [] };
  } catch {
    return { ok: false };
  }
}

export async function fetchTop(board) {
  try {
    const r = await fetch(`${BASE}/api/lb-top?site=${SITE}&board=${encodeURIComponent(board)}`);
    if (!r.ok) return { ok: false };
    const d = await r.json();
    return { ok: true, top: d.top || [] };
  } catch {
    return { ok: false };
  }
}
