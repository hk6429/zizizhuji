import { shuffle } from './shuffle.js';

function pickN(correct, pool, n) {
  const candidates = [...new Set(pool.filter(x => x !== correct))];
  if (candidates.length < n) {
    throw new Error('not enough distractor candidates');
  }
  return shuffle(candidates).slice(0, n);
}

export function pickCharDistractors(correctChar, pool, n = 3) {
  return pickN(correctChar, pool, n);
}

export function pickChengyuDistractors(correctPhrase, pool, n = 3) {
  return pickN(correctPhrase, pool, n);
}
