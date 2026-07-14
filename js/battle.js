const BASE_DAMAGE = 10;
const COMBO_BONUS_DAMAGE = 15;
const COMBO_THRESHOLD = 3;

export function createBattleState() {
  return { hpA: 100, hpB: 100, comboA: 0, comboB: 0 };
}

export function applyAnswer(state, side, correct) {
  const next = { ...state };
  const comboKey = side === 'A' ? 'comboA' : 'comboB';
  const targetHpKey = side === 'A' ? 'hpB' : 'hpA';

  if (!correct) {
    next[comboKey] = 0;
    return next;
  }

  next[comboKey] = state[comboKey] + 1;
  const damage = next[comboKey] >= COMBO_THRESHOLD ? COMBO_BONUS_DAMAGE : BASE_DAMAGE;
  next[targetHpKey] = Math.max(0, state[targetHpKey] - damage);
  return next;
}

export function isBattleOver(state) {
  return state.hpA <= 0 || state.hpB <= 0;
}
