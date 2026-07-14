// 自學小遊戲共用：從「字音字形」題庫抽「目標字 ↔ 注音」乾淨配對。
// 記憶配對牌與連連看都吃這份配對，不捏造任何字義。
// 目標字＝題幹最後一組「…」內的單字；注音＝該題 answer（僅取注音答案，字形題略過）。

const ZHUYIN = /^[ㄅ-ㄩˊˇˋ˙ˉ]+$/; // 注音符號 ㄅ–ㄩ ＋ 聲調符號

export function isZhuyin(s) {
  return typeof s === 'string' && ZHUYIN.test(s);
}

export function extractTargetChar(question) {
  const matches = [...String(question).matchAll(/「([^」]+)」/g)];
  if (!matches.length) return null;
  const last = matches[matches.length - 1][1]; // 被問的通常是最後一組引號
  return [...last].length === 1 ? last : null;  // 只收單字，配對才乾淨
}

// 回傳 [{ char, zhuyin, id }]，char 去重。limit 為 0/undefined 時不設限。
export function buildPairs(bank, limit = 0) {
  const seen = new Set();
  const pairs = [];
  for (const e of bank || []) {
    if (!isZhuyin(e.answer)) continue;
    const ch = extractTargetChar(e.question);
    if (!ch || seen.has(ch)) continue;
    seen.add(ch);
    pairs.push({ char: ch, zhuyin: e.answer, id: e.id });
    if (limit && pairs.length >= limit) break;
  }
  return pairs;
}

// 洗牌後取 n 組配對（供單局出牌）。bank 不足時回傳實際可得數量。
export function samplePairs(bank, n) {
  const all = buildPairs(bank);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, n);
}
