import { addXp } from './meta/progress.js';

// 非練習模式的前端結算文氣：一般答對基準為 10 XP，結算只回饋約一成（每題 1 XP）。
export function resultXpBonus({ correct = 0, answered = 0, won = false, requireWin = false } = {}) {
  const goodAccuracy = answered > 0 && correct / answered >= 0.7;
  if (requireWin ? !won : !(won || goodAccuracy)) return 0;
  return Math.max(1, Math.round(Math.max(0, correct)));
}

export function awardResultXp(meta, result) {
  const bonus = resultXpBonus(result);
  if (bonus) addXp(meta, bonus);
  return bonus;
}
