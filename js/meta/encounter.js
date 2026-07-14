// M7 墨池奇遇：每題結算後擲骰。基礎 8% 觸發＋保底（連 12 題未觸發第 13 題必觸發）。
// 同事件不連續出現兩次；全部正面事件（適齡）。rng 可注入以便測試重現。

export const BASE_RATE = 0.08;
export const PITY_THRESHOLD = 12; // sinceLast 達 12（即連 12 題未觸發）後下一題必觸發

export const BATTLE_EVENTS = [
  { id: 'wenqu', name: '文曲星閃現', weight: 30, desc: '下一題傷害 ×2', effect: { type: 'doubleDamage' } },
  { id: 'moling', name: '墨靈贈珠', weight: 25, desc: '獲得 3 顆字珠', effect: { type: 'pearls', amount: 3 } },
  { id: 'ziyao', name: '字妖突襲', weight: 20, desc: '限時挑戰題！答對回 10 點 HP，答錯無懲罰', effect: { type: 'challenge', healOnWin: 10 } },
  { id: 'gujuan', name: '古卷破損', weight: 15, desc: '下一題自動排除一個錯誤選項', effect: { type: 'eliminate', count: 1 } },
  { id: 'yantai', name: '硯台生輝', weight: 10, desc: '本場連對門檻降為 2', effect: { type: 'comboThreshold', value: 2 } },
];

// 練習模式共用同一張事件表（同 id 同權重），效果改為珠／提示類。
export const PRACTICE_EVENTS = [
  { id: 'wenqu', name: '文曲星閃現', weight: 30, desc: '下一題字珠 ×2', effect: { type: 'doublePearls' } },
  { id: 'moling', name: '墨靈贈珠', weight: 25, desc: '獲得 3 顆字珠', effect: { type: 'pearls', amount: 3 } },
  { id: 'ziyao', name: '字妖掉珠', weight: 20, desc: '字妖倉皇逃走，掉下 2 顆字珠', effect: { type: 'pearls', amount: 2 } },
  { id: 'gujuan', name: '古卷破損', weight: 15, desc: '下一題自動排除一個錯誤選項', effect: { type: 'eliminate', count: 1 } },
  { id: 'yantai', name: '硯台生輝', weight: 10, desc: '下一題字珠 ×2', effect: { type: 'doublePearls' } },
];

function weightedPick(pool, rng) {
  const totalWeight = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * totalWeight;
  for (const e of pool) {
    roll -= e.weight;
    if (roll < 0) return e;
  }
  return pool[pool.length - 1];
}

// opts.rate 可覆蓋觸發率（天機「靈感日」8%→15%）。
export function rollEncounter(meta, mode, rng = Math.random, opts = {}) {
  const table = mode === 'battle' ? BATTLE_EVENTS : PRACTICE_EVENTS;
  const rate = opts.rate ?? BASE_RATE;
  const enc = meta.encounter;

  const pity = enc.sinceLast >= PITY_THRESHOLD;
  if (!pity && rng() >= rate) {
    enc.sinceLast += 1;
    return { meta, event: null };
  }

  let pool = table;
  if (enc.lastEventId && table.length > 1) {
    pool = table.filter(e => e.id !== enc.lastEventId);
  }
  const event = weightedPick(pool, rng);
  enc.sinceLast = 0;
  enc.lastEventId = event.id;
  enc.totalCount += 1;
  return { meta, event };
}
