// 答題後是否應停留到玩家手動前進：練習一律停留；自動節奏僅答錯停留，讓解說可讀完。
export function shouldWaitForNext(correct, manualMode = false) {
  return manualMode || !correct;
}
