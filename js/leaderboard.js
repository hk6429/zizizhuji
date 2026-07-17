// 班級共享排行榜（M3，非即時）：分數存自家 Cloudflare Pages Function + D1（見 functions/api/lb-*.js）。
// naicheng-counter 已退役（2026-07-16），改走自家後端，不再依賴共用第三方站。
// 後端斷線一律靜默回 {ok:false}，絕不擋積分競技本體遊玩。

export async function submitScore(board, name, score) {
  try {
    const r = await fetch('/api/lb-submit', {
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
    const r = await fetch(`/api/lb-top?board=${encodeURIComponent(board)}`);
    if (!r.ok) return { ok: false };
    const d = await r.json();
    return { ok: true, top: d.top || [] };
  } catch {
    return { ok: false };
  }
}
