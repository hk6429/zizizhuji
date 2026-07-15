// 無限迴圈模式（獨自衝分／自學練習）的「今日已完成」停頓點：純函式，供多處共用同一顆常數。
export function shouldCheckpoint(answeredCount, everyN = 15) {
  return answeredCount > 0 && answeredCount % everyN === 0;
}
