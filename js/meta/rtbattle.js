// 即時對戰純邏輯：同 seed 不同機出同一組題；傷害權威在攻擊方。
// UI 層在 js/rtbattle-ui.js；本檔零 DOM、零網路，全部可 node --test。
export const ROUNDS = 20;
export const ROUND_SEC = 15;
export const POLL_MS = 1500;
export const DEAD_MS = 20000;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildQuestions(seed, entries, rounds = ROUNDS) {
  const rng = mulberry32(seed);
  // 先依 id 排序：兩機的 entries 載入順序不同也能出同序（同 vocab-duel 手法）
  const sorted = [...entries].sort((a, b) => (a.id < b.id ? -1 : 1));
  const pick = [];
  const used = new Set();
  while (pick.length < Math.min(rounds, sorted.length) && used.size < sorted.length) {
    const i = Math.floor(rng() * sorted.length);
    if (used.has(i)) continue;
    used.add(i);
    pick.push(sorted[i]);
  }
  return pick.map((e) => {
    const options = [...e.options];
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]];
    }
    return { id: e.id, type: e.type, question: e.question, options, answer: e.answer, explain: e.explain || [] };
  });
}

export function dealtDamage(prevState, nextState) {
  return Math.max(0, prevState.hpB - nextState.hpB);
}

export function judge({ myHp, oppHp, myDone, oppDone, oppHbAgeMs }) {
  if (oppHbAgeMs > DEAD_MS) return 'win'; // 對手斷線
  if (myHp <= 0 && oppHp <= 0) return 'draw';
  if (myHp <= 0) return 'lose';
  if (oppHp <= 0) return 'win';
  if (myDone && oppDone) return myHp > oppHp ? 'win' : myHp < oppHp ? 'lose' : 'draw';
  return null;
}
