// 回歸玩家迎接：純函式判斷是否該顯示「好久不見」的非阻斷歡迎，不做任何持久化副作用。
// 全新玩家（從未點過燈）不觸發——交給既有的開卷誓言。

import { dayDiff } from './daily.js';

export const ABSENCE_THRESHOLD_DAYS = 3;

export function checkWelcomeBack(meta, today) {
  const lastLit = meta.daily.lastLit;
  if (!lastLit) return { show: false, daysAway: 0 };
  const daysAway = dayDiff(lastLit, today);
  return { show: daysAway >= ABSENCE_THRESHOLD_DAYS, daysAway };
}
