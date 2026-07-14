function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
