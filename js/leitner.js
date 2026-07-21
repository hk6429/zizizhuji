const MAX_BOX = 5;
const MIN_BOX = 1;
const WRONG_DROP = 2; // 答錯退步幅度：退 2 級而非打回第 1 盒，避免練到一半答錯就前功盡棄

// 難度數字愈小愈先出（同盒位時當 tie-break），未知難度視為中等
const DIFFICULTY_RANK = { 易: 0, 中: 1, 難: 2 };

export function createLeitnerState(ids) {
  return new Map(ids.map(id => [id, MIN_BOX]));
}

export function recordAnswer(state, id, correct) {
  const current = state.get(id) ?? MIN_BOX;
  state.set(id, correct ? Math.min(current + 1, MAX_BOX) : Math.max(current - WRONG_DROP, MIN_BOX));
}

// 同字聚焦複習：答錯某破音字時，讓「同一個字」的其他題也退一盒、提早再出現，
// 把複習從「單題」升級到「錯誤模式」。退幅比本題(WRONG_DROP)小，只是輕推不重罰。
// siblingIds 不含本題自己；不在 state 內的 id 忽略。
export function boostSiblings(state, siblingIds, drop = 1) {
  for (const id of siblingIds || []) {
    if (!state.has(id)) continue;
    state.set(id, Math.max((state.get(id) ?? MIN_BOX) - drop, MIN_BOX));
  }
}

// byId（可選）：id → entry，entry.difficulty 存在時用來在同盒位時優先出較易的題
export function nextQuestionId(state, ids, byId) {
  return ids.reduce((lowest, id) => {
    const box = state.get(id);
    const lowestBox = state.get(lowest);
    if (box < lowestBox) return id;
    if (box === lowestBox && byId) {
      const rank = DIFFICULTY_RANK[byId.get(id)?.difficulty] ?? 1;
      const lowestRank = DIFFICULTY_RANK[byId.get(lowest)?.difficulty] ?? 1;
      if (rank < lowestRank) return id;
    }
    return lowest;
  }, ids[0]);
}
