// M8 每日三事：文脈長明燈（streak＋4 階燈）＋硯池墨匣（每日限開/週日琉璃匣）＋每日天機（日期 hash 籤）。
// 每日行為只有一個：「當日累計答對 ≥10 題」，同時餵三件事。
// 跨日判定一律本地 YYYY-MM-DD 字串；週以 ISO 週為 key。日期工具由此模組輸出供 oath/arena 共用。

import { earnPearls } from './economy.js';

export const DAILY_GOAL = 10;
export const MAX_CHARMS = 2;
export const WEEK_HALF_DAYS = 3; // 週琉璃匣未達 5 天時的部分獎勵門檻

const NODAMAGE_KEY = 'zizhu:noDamageMode';
function noDamageOn() {
  try { return localStorage.getItem(NODAMAGE_KEY) === '1'; } catch { return false; }
}

export const LANTERN_TIERS = [
  { tier: 0, name: '油燈', minStreak: 0 },
  { tier: 1, name: '銅燈', minStreak: 7 },
  { tier: 2, name: '琉璃燈', minStreak: 21 },
  { tier: 3, name: '七寶燈', minStreak: 49 },
];

export const LANTERN_MILESTONES = [
  { days: 3, pearls: 5, title: '初燃墨燈' },
  { days: 7, pearls: 15, title: '守燈童子' },
  { days: 14, pearls: 30, title: '燈火不熄' },
  { days: 30, pearls: 60, title: '墨燈長明' },
  { days: 60, pearls: 100, title: '長明書燈' },
];

export const OMENS = [
  { id: 'moyu', name: '墨雨日', desc: '今日對戰傷害 +2', effect: { type: 'damageBonus', value: 2 } },
  { id: 'zhufeng', name: '珠豐日', desc: '今日字珠獲得 ×2', effect: { type: 'pearlMult', value: 2 } },
  { id: 'linggan', name: '靈感日', desc: '今日奇遇機率 8%→15%', effect: { type: 'encounterRate', value: 0.15 } },
  { id: 'jingxin', name: '靜心日', desc: '練習答對每題額外 +1 珠', effect: { type: 'practicePearlBonus', value: 1 } },
  { id: 'mingmu', name: '明目日', desc: '每場對戰開局送一次排除選項', effect: { type: 'freeEliminate', value: 1 } },
  { id: 'lianxin', name: '連心日', desc: '今日墨靈羈絆獲得 ×2', effect: { type: 'bondMult', value: 2 } },
  { id: 'wenqu', name: '文曲日', desc: '今日文氣獲得 ×1.5', effect: { type: 'xpMult', value: 1.5 } },
];

// ---- 日期工具（供 oath.js / arena.js 共用）----

export function hashStr(s) {
  let h = 0x811c9dc5; // FNV-1a 32-bit
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function utcOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function dayDiff(fromStr, toStr) {
  return Math.round((utcOf(toStr) - utcOf(fromStr)) / 86400000);
}

export function isoWeekKey(dateStr) {
  const dt = new Date(utcOf(dateStr));
  const day = (dt.getUTCDay() + 6) % 7; // Mon=0
  dt.setUTCDate(dt.getUTCDate() - day + 3); // 本週四
  const week1 = new Date(Date.UTC(dt.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((dt - week1) / 86400000 - 3 + ((week1.getUTCDay() + 6) % 7)) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function isSunday(dateStr) {
  return new Date(utcOf(dateStr)).getUTCDay() === 0;
}

function tierOf(streak) {
  let t = 0;
  for (const l of LANTERN_TIERS) if (streak >= l.minStreak) t = l.tier;
  return t;
}

// ---- 跨日/跨週滾動（冪等；getter 與 record 都會先呼叫）----

export function rolloverDaily(meta, today) {
  const d = meta.daily;
  const events = [];
  if (d.date === today) return events;

  // 斷守判定：上次點燈到今天之間有沒有漏掉的整天
  if (d.lastLit && d.lastLit !== today) {
    const missed = dayDiff(d.lastLit, today) - 1;
    if (missed > 0) {
      if (d.charms >= missed) {
        d.charms -= missed;
        events.push({
          type: 'charmUsed',
          payload: { days: missed, remaining: d.charms, message: '護珠符替你守住了墨燈' },
          fx: 'charm-glow',
        });
      } else if (d.streak > 0) {
        // 熄燈但「不清階級」：d.tier 保留。無傷模式開啟時只腰斬連燈數，不做恐懼式恐嚇；
        // 兩種模式文案都改中性語氣（去掉「侵蝕」這類威脅框架），機制本身只在無傷模式軟化。
        const softened = noDamageOn();
        d.streak = softened ? Math.floor(d.streak / 2) : 0;
        events.push({
          type: 'lanternOut',
          payload: {
            softened,
            message: softened
              ? '墨靈幫你守住了半分燈火，明日再努力就好'
              : '墨燈熄了一晚，今天重新點亮就好',
          },
          fx: softened ? 'lantern-half' : 'lantern-dim',
        });
      }
    }
  }

  const wk = isoWeekKey(today);
  if (d.weekKey !== wk) {
    d.weekKey = wk;
    d.weekOpenDays = [];
    d.liuliOpened = false;
    d.liuliHalfOpened = false;
  }

  d.date = today;
  d.todayCorrect = 0;
  d.boxOpened = false;
  return events;
}

// ---- 每日行為：答對 n 題 ----

export function recordDailyCorrect(meta, n, today) {
  const events = rolloverDaily(meta, today);
  const d = meta.daily;
  d.todayCorrect += n;

  const alreadyLit = d.lastLit === today;
  if (!alreadyLit && d.todayCorrect >= DAILY_GOAL) {
    d.lastLit = today;
    d.streak += 1;
    d.best = Math.max(d.best, d.streak);

    const t = tierOf(d.streak);
    if (t > d.tier) {
      d.tier = t;
      events.push({
        type: 'lanternTierUp',
        payload: { tier: t, name: LANTERN_TIERS[t].name },
        fx: 'lantern-tier-up',
      });
    }
    events.push({
      type: 'lanternLit',
      payload: { streak: d.streak, tier: d.tier, message: '今日文脈由你守住了' },
      fx: 'lantern-lit',
    });
    events.push({ type: 'boxUnlocked', payload: { date: today }, fx: 'box-appear' });

    if (d.streak > 0 && d.streak % 7 === 0 && d.charms < MAX_CHARMS) {
      d.charms += 1;
      events.push({ type: 'charmGranted', payload: { charms: d.charms }, fx: 'charm-new' });
    }

    for (const m of LANTERN_MILESTONES) {
      if (d.streak === m.days && !d.milestonesClaimed.includes(m.days)) {
        d.milestonesClaimed.push(m.days);
        earnPearls(meta, m.pearls, 'lantern-milestone', today);
        events.push({
          type: 'lanternMilestone',
          payload: { days: m.days, pearls: m.pearls, title: m.title },
          fx: 'milestone-stamp',
        });
      }
    }
  }
  return { meta, events };
}

// ---- getter ----

export function getLanternState(meta, today) {
  rolloverDaily(meta, today);
  const d = meta.daily;
  return {
    streak: d.streak,
    tier: d.tier,
    tierName: LANTERN_TIERS[d.tier].name,
    litToday: d.lastLit === today,
    todayCorrect: d.todayCorrect,
    goal: DAILY_GOAL,
    best: d.best,
    charms: d.charms,
  };
}

export function getBoxState(meta, today) {
  rolloverDaily(meta, today);
  const d = meta.daily;
  return {
    unlocked: d.lastLit === today,
    opened: d.boxOpened,
    weekOpenDays: [...d.weekOpenDays],
    liuliAvailable: isSunday(today) && d.weekOpenDays.length >= 5 && !d.liuliOpened,
    // 半程獎勵：未達 5 天全勤也有小獎勵可拿，不分無傷模式一律生效（純加分，不影響滿勤獎的價值）
    halfAvailable: isSunday(today) && d.weekOpenDays.length >= WEEK_HALF_DAYS
      && d.weekOpenDays.length < 5 && !d.liuliHalfOpened,
  };
}

export function openBox(meta, today, rng = Math.random) {
  rolloverDaily(meta, today);
  const d = meta.daily;
  if (d.lastLit !== today) return { ok: false, reason: 'locked' };
  if (d.boxOpened) return { ok: false, reason: 'opened' };

  d.boxOpened = true;
  if (!d.weekOpenDays.includes(today)) d.weekOpenDays.push(today);

  let pearls = 3 + Math.floor(rng() * 6); // 3–8
  let liuli = false;
  let weekTitle = null;
  if (isSunday(today) && d.weekOpenDays.length >= 5 && !d.liuliOpened) {
    d.liuliOpened = true;
    liuli = true;
    pearls += 20;
    weekTitle = '本週琉璃使者';
  } else if (isSunday(today) && d.weekOpenDays.length >= WEEK_HALF_DAYS && !d.liuliHalfOpened) {
    d.liuliHalfOpened = true;
    pearls += 8;
    weekTitle = '本週半程使者';
  }
  earnPearls(meta, pearls, 'daily-box', today);
  return { meta, reward: { pearls, liuli, weekTitle, glow: '青光' } };
}

export function getOmen(dateStr) {
  const omen = OMENS[hashStr(`zzj-omen-${dateStr}`) % OMENS.length];
  return { omenId: omen.id, name: omen.name, desc: omen.desc, effect: omen.effect };
}
