// M9 護符雙保險：
// 戰鬥內建（無庫存、每場各自動一次）：護心墨符（連對 ≥5 答錯改減半）＋書生殘卷（HP 首次跌破 10 停在 10）。
// 護珠符（庫存道具，上限 2）：只作用於守燈，斷日自動消耗補日（消耗邏輯在 daily.rolloverDaily）。

export const CHARM_CAP = 2;

export function createBattleGuards() {
  return { comboUsed: false, hpUsed: false };
}

// 答錯時的連對結算：連對 ≥5 且本場尚未觸發 → 減半而非歸零。
export function guardCombo(prevCombo, guards) {
  if (prevCombo >= 5 && !guards.comboUsed) {
    return {
      combo: Math.floor(prevCombo / 2),
      triggered: true,
      guards: { ...guards, comboUsed: true },
    };
  }
  return { combo: 0, triggered: false, guards };
}

// 玩家 HP 結算：首次要跌破 10 時停在 10。
export function guardHp(hp, guards) {
  if (hp < 10 && !guards.hpUsed) {
    return { hp: 10, triggered: true, guards: { ...guards, hpUsed: true } };
  }
  return { hp, triggered: false, guards };
}

export function grantStreakCharm(meta) {
  meta.daily.charms = Math.min(CHARM_CAP, meta.daily.charms + 1);
  return meta;
}

export function consumeStreakCharm(meta) {
  if (meta.daily.charms <= 0) return { meta, ok: false };
  meta.daily.charms -= 1;
  return { meta, ok: true };
}
