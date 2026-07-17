// M4 文氣境界：文氣 XP（不可花）＋八境界（蒙童→翰林）。升境事件供「開悟」動畫。

export const RANKS = [
  { name: '蒙童', threshold: 0, blessing: '執筆之初，萬字皆新。' },
  { name: '識字生', threshold: 100, blessing: '你認得的字，開始認得你了。' },
  { name: '抄書郎', threshold: 300, blessing: '一筆一畫，皆是修行。' },
  { name: '誦典生', threshold: 700, blessing: '朗朗書聲，濁墨退避。' },
  { name: '秀才', threshold: 1500, blessing: '筆下有神，鄉里稱奇。' },
  { name: '舉人', threshold: 3000, blessing: '文氣沖霄，墨界震動。' },
  { name: '貢士', threshold: 5500, blessing: '殿前對答，字字珠璣。' },
  { name: '翰林', threshold: 9000, blessing: '執掌文脈，護典有你。' },
  { name: '大學士', threshold: 15000, blessing: '學貫古今，眾人景仰。' },
  { name: '文曲星', threshold: 24000, blessing: '星輝墨海，文脈由你傳承萬世。' },
];

function rankOf(xpValue) {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (xpValue >= RANKS[i].threshold) idx = i;
  }
  return idx;
}

export function addXp(meta, amount) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { meta, leveledUp: false, newRank: null };
  }
  meta.xp.value += Math.round(amount);
  const idx = rankOf(meta.xp.value);
  if (idx > meta.xp.rank) {
    meta.xp.rank = idx;
    return {
      meta,
      leveledUp: true,
      newRank: { rank: idx, name: RANKS[idx].name, blessing: RANKS[idx].blessing },
    };
  }
  return { meta, leveledUp: false, newRank: null };
}

export function getProgress(meta) {
  const idx = meta.xp.rank;
  const next = RANKS[idx + 1] || null;
  return {
    xp: meta.xp.value,
    rank: idx,
    rankName: RANKS[idx].name,
    nextThreshold: next ? next.threshold : null,
  };
}
