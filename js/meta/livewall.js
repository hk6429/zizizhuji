// 全班戰況牆純邏輯：白帽排名裁切＋墨靈宣讀戰報（語感承 arena.js buildBroadcast）。
export function safeBoard(rows, myNick, topN = 5) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, topN).map(({ nick, score }) => ({ nick, score }));
  const idx = sorted.findIndex(r => r.nick === myNick);
  const me = idx >= topN ? { rank: idx + 1, nick: myNick, score: sorted[idx].score } : null;
  return { top, me, total: sorted.length };
}

export function buildLiveHerald({ week, rows }) {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const champ = sorted[0];
  if (!champ) return [`墨靈宣讀：${week} 隨堂擂台虛位以待，誰是第一位挑戰者？`];
  return [
    `墨靈宣讀：${week} 隨堂戰況——`,
    `本場魁首：${champ.nick}！答對 ${champ.score} 題，技驚墨界！`,
    ...sorted.slice(1, 3).map((e, i) => `第${i === 0 ? '二' : '三'}名：${e.nick}，答對 ${e.score} 題。`),
    '眾書生聞聲而賀，濁墨退散三尺！',
  ];
}
