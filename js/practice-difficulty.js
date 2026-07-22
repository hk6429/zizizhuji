export const HARD_UNLOCK_MASTERY = 20;
export const HARD_PRACTICE_UNLOCK_KEY = 'zizhu:hardPracticeUnlocked';

function masteredCount(meta) {
  return Object.values(meta?.collection || {}).filter((item) => item?.earnedAt).length;
}

export function isHardPracticeUnlocked(meta, storage = globalThis.localStorage) {
  try {
    if (storage?.getItem(HARD_PRACTICE_UNLOCK_KEY) === '1') return true;
  } catch {}
  const unlocked = masteredCount(meta) >= HARD_UNLOCK_MASTERY;
  if (unlocked) {
    try { storage?.setItem(HARD_PRACTICE_UNLOCK_KEY, '1'); } catch {}
  }
  return unlocked;
}

export function practicePoolForPlayer(bank, meta, storage = globalThis.localStorage) {
  if (isHardPracticeUnlocked(meta, storage)) return bank.slice();
  return bank.filter((q) => q.difficulty === '易' || q.difficulty === '中');
}
