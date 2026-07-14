// M6 煉字三訣：戰中墨氣條（答對 +1，滿 5 發動、發動歸零、每場最多 3 次）。
// 戰前擇一帶入：點睛訣（勝 5 場）／潑墨訣（勝 15 場）／守心訣（勝 30 場）。
// ArtSession 為純資料，效果由 battle-adapter 以 one-shot flag 套用。

export const INK_MAX = 5;
export const MAX_CASTS = 3;

export const ARTS = [
  { id: 'dianjing', name: '點睛訣', unlockWins: 5, desc: '本題刪去 2 個錯誤選項', effect: { type: 'eliminate', count: 2 } },
  { id: 'pomo', name: '潑墨訣', unlockWins: 15, desc: '下一題傷害 ×2', effect: { type: 'doubleDamage' } },
  { id: 'shouxin', name: '守心訣', unlockWins: 30, desc: '接下來 2 題答錯不斷連對', effect: { type: 'comboShield', count: 2 } },
];

// 依累計勝場同步解鎖清單；回傳新解鎖的訣（給 UI 演出）。
export function syncUnlocks(meta) {
  const newlyUnlocked = [];
  for (const art of ARTS) {
    if (meta.arts.battlesWon >= art.unlockWins && !meta.arts.unlocked.includes(art.id)) {
      meta.arts.unlocked.push(art.id);
      newlyUnlocked.push(art);
    }
  }
  return { meta, newlyUnlocked };
}

export function equipArt(meta, artId) {
  if (artId === null) {
    meta.arts.equipped = null;
    return { meta, ok: true };
  }
  if (!meta.arts.unlocked.includes(artId)) return { meta, ok: false };
  meta.arts.equipped = artId;
  return { meta, ok: true };
}

export function createArtSession(meta) {
  return { artId: meta.arts.equipped, ink: 0, casts: 0 };
}

// 答對得墨氣（洮硯 inkBonus +1）；純函式回傳新 session。
export function gainInk(session, inkBonus = 0) {
  return { ...session, ink: Math.min(INK_MAX, session.ink + 1 + inkBonus) };
}

export function castArt(session) {
  if (!session.artId || session.ink < INK_MAX || session.casts >= MAX_CASTS) {
    return { ok: false };
  }
  const art = ARTS.find(a => a.id === session.artId);
  if (!art) return { ok: false };
  return {
    session: { ...session, ink: 0, casts: session.casts + 1 },
    effect: { ...art.effect, artId: art.id, name: art.name },
  };
}
