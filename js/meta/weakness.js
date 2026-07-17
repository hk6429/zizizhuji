// 弱點分類統計：依題目 entry.type（字音/字形/意義/近似成語/錯別字）累計正確/錯誤次數，
// 供錯題本／家長儀表板顯示「哪一類最弱」。純函式，資料落在 meta.weak（見 store.js）。

export function recordWeakness(meta, type, correct) {
  if (!type) return;
  if (!meta.weak) meta.weak = {};
  const w = meta.weak[type] || (meta.weak[type] = { correct: 0, wrong: 0 });
  if (correct) w.correct += 1;
  else w.wrong += 1;
}

// 回傳依正確率由低到高排序的弱點分類清單：[{type, correct, wrong, total, accuracy}]
export function getWeaknessSummary(meta) {
  const weak = (meta && meta.weak) || {};
  return Object.keys(weak)
    .map((type) => {
      const { correct, wrong } = weak[type];
      const total = correct + wrong;
      return { type, correct, wrong, total, accuracy: total > 0 ? correct / total : 0 };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy);
}
