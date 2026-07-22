// zizizhuji/js/integration.js
// 八角機制層 ↔ UI 接線（規格：docs/octalysis-integration.md）
// 機制模組唯讀；本檔只負責呼叫與渲染，持久化一律經 js/meta 模組。

import * as kernel from './meta/kernel.js';
import { saveMeta } from './meta/store.js';
import { getBalance, DAILY_EARN_CAP } from './meta/economy.js';
import { getProgress, RANKS } from './meta/progress.js';
import { getLanternState, getBoxState, openBox } from './meta/daily.js';
import * as oath from './meta/oath.js';
import { markMilestoneSeen } from './meta/world.js';
import { getBond, pickLine, MOLING_STORY } from './meta/bond.js';
import { playLevelUp } from './sound.js';
import {
  createBattleContext, createBattleStateEx, takeEliminate, isOverEx,
} from './meta/battle-adapter.js';
import { getPetBattleMods, syncUnlocks as syncPetUnlocks, listPets } from './meta/pet.js';
import { getCubBattleMods } from './meta/fusion-store.js';
import { shouldOfferShareCard, renderShareCard, exportShareCard } from './meta/share-card.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';
import { submitGlobalXp } from './leaderboard.js';
import { getQuests } from './meta/quests.js';
import { maybeOfferNoDamage } from './nodamage-prompt.js';

const $ = (id) => document.getElementById(id);

// 天下文氣榜同步：回首頁刷新時，若有暱稱且文氣有長進就靜默上傳一次（後端斷線不影響本體）。
let lastGlobalXp = -1;
function syncGlobalRank(meta) {
  const nick = String(meta?.selfstudy?.nick || '').trim();
  const xp = meta?.xp?.value || 0;
  if (!nick || xp <= lastGlobalXp) return;
  lastGlobalXp = xp;
  submitGlobalXp(nick, xp).catch(() => {});
}

let ctx = null;
let today = '';

export const getCtx = () => ctx;
export const getToday = () => today;

/* ---------- 開站：initSession ＋首訪誓言＋天機＋回補信件 ---------- */

export function ensureMeta(banks) {
  if (ctx) return ctx;
  today = new Date().toLocaleDateString('sv');
  const init = kernel.initSession(today, banks);
  ctx = init.ctx;

  if (init.omen) renderOmenLine(init.omen);
  for (const letter of init.pendingMilestones) {
    toast(`墨界回信・${letter.title}｜${letter.text}`, 'letter');
    markMilestoneSeen(ctx.meta, letter.id);
  }
  if (init.pendingMilestones.length) saveMeta(ctx.meta);

  // 不再進站就強制彈「開卷・立誓」——改由首頁 oath-line 當常駐 CTA，讓新手先玩再立誓。
  refreshWidgets();
  return ctx;
}

// 今日天機視覺化：籤形徽章（每種天機一個字符＋專屬色），取代舊的純文字一行
const OMEN_GLYPHS = {
  moyu: '雨', zhufeng: '珠', linggan: '靈', jingxin: '靜',
  mingmu: '目', lianxin: '心', wenqu: '文',
};

function renderOmenLine(omen) {
  const el = $('omen-line');
  el.innerHTML = '';
  el.className = `omen-line omen-line--${omen.omenId}`;
  const icon = document.createElement('span');
  icon.className = 'omen-glyph';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = OMEN_GLYPHS[omen.omenId] || '機';
  const body = document.createElement('span');
  body.className = 'omen-body';
  body.innerHTML = `<b class="omen-name">今日天機「${omen.name}」</b><span class="omen-desc">${omen.desc}</span>`;
  el.append(icon, body);
  el.hidden = false;
}

function showOathOverlay(intro) {
  const overlay = $('oath-overlay');
  const story = $('oath-story');
  story.innerHTML = '';
  for (const card of intro.cards) {
    const p = document.createElement('p');
    p.textContent = card.text;
    story.appendChild(p);
  }
  const list = $('oath-list');
  list.innerHTML = '';
  const notice = $('oath-notice');
  notice.hidden = true;
  const swear = (oathId, customText = '') => {
    const result = oath.swearOath(ctx.meta, oathId, today, customText);
    oath.markIntroSeen(ctx.meta);
    saveMeta(ctx.meta);
    if (!result.ok) {
      notice.textContent = result.reason === 'bad-custom-text'
        ? '自訂誓言要 2–20 個字喔。'
        : '距離上次立誓未滿 30 天，暫時無法換誓。';
      notice.hidden = false;
      return;
    }
    closeOverlay(overlay);
    refreshWidgets();
  };
  for (const o of intro.oaths) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'oath-btn';
    btn.textContent = o.text;
    btn.addEventListener('click', () => swear(o.id));
    list.appendChild(btn);
  }
  const customInput = $('oath-custom-input');
  customInput.value = '';
  $('oath-custom-btn').onclick = () => swear(oath.CUSTOM_OATH_ID, customInput.value);
  const skip = () => {
    oath.markIntroSeen(ctx.meta);
    saveMeta(ctx.meta);
    closeOverlay(overlay);
  };
  $('oath-skip').onclick = skip;
  openOverlay(overlay, skip);
}

function showStoryOverlay() {
  const overlay = $('story-overlay');
  const story = $('story-story');
  story.innerHTML = '';
  for (const card of MOLING_STORY) {
    const p = document.createElement('p');
    p.textContent = card.text;
    story.appendChild(p);
  }
  const close = () => closeOverlay(overlay);
  $('story-close').onclick = close;
  openOverlay(overlay, close);
}

// 首頁常駐誓言列可點擊重開誓言卡（回顧誓詞／滿 30 天可換誓）
$('oath-line').addEventListener('click', () => {
  if (!ctx) return;
  showOathOverlay({ cards: oath.INTRO_CARDS, oaths: oath.OATHS });
});

/* ---------- 主畫面常駐面板 ---------- */

export function refreshWidgets() {
  if (!ctx) return;
  const meta = ctx.meta;

  $('pearl-balance').textContent = getBalance(meta);

  const p = getProgress(meta);
  $('rank-name').textContent = p.rankName;
  const prev = RANKS[p.rank].threshold;
  const pct = p.nextThreshold === null
    ? 100
    : Math.min(100, Math.round(((p.xp - prev) / (p.nextThreshold - prev)) * 100));
  $('rank-fill').style.width = `${pct}%`;
  $('rank-xp').textContent = p.nextThreshold === null ? '文氣圓滿' : `文氣 ${p.xp} / ${p.nextThreshold}`;

  const l = getLanternState(meta, today);
  const lantern = $('lantern-widget');
  lantern.classList.toggle('lantern--lit', l.litToday);
  $('lantern-text').textContent =
    `${l.tierName}・守燈 ${l.streak} 天｜今日 ${Math.min(l.todayCorrect, l.goal)}/${l.goal}` +
    (l.charms > 0 ? `｜護珠符 ×${l.charms}` : '');

  const box = getBoxState(meta, today);
  const boxBtn = $('daily-box');
  boxBtn.hidden = false;
  boxBtn.disabled = !box.unlocked || box.opened;
  boxBtn.textContent = box.opened ? '墨匣已開' : (box.unlocked ? (box.liuliAvailable ? '開琉璃匣！' : '開墨匣！') : `煉滿 ${l.goal} 字開匣`);

  const o = oath.getOath(meta, today);
  const oathLine = $('oath-line');
  if (o) {
    oathLine.textContent = `【誓】${o.oathText}`;
    oathLine.classList.remove('oath-line--cta');
  } else {
    // 未立誓：把它當常駐邀請 CTA，取代進站強制彈窗
    oathLine.textContent = '✍️ 立下你的修行誓言（點我）';
    oathLine.classList.add('oath-line--cta');
  }
  oathLine.hidden = false;

  refreshPetEntry();
  syncGlobalRank(meta);

  renderHomeQuests(meta, today);
}

/* 每日任務常駐面板（首頁直接呈現難／中／易完成度） */
function renderHomeQuests(meta, today) {
  const listEl = $('home-quests-list');
  if (!listEl) return;
  listEl.innerHTML = getQuests(meta, today).map((q) => {
    const pct = Math.min(100, Math.round((q.progress / q.goal) * 100));
    let btn;
    if (q.claimed) btn = '<button class="quest-claim" type="button" disabled>已領取</button>';
    else if (q.done) btn = `<button class="quest-claim quest-claim--on" type="button" data-quest="${q.id}">領取 ${q.reward} 珠</button>`;
    else btn = `<button class="quest-claim" type="button" disabled>還差 ${q.goal - q.progress}</button>`;
    return `<div class="quest-row quest-row--${q.tier}${q.claimed ? ' is-claimed' : ''}">
      <div class="quest-row__top"><span class="quest-tier">${q.tier}</span><b class="quest-name">${q.name}</b><span class="quest-reward">🪙 ${q.reward}</span></div>
      <div class="quest-desc">${q.desc}</div>
      <div class="quest-bar"><span style="width:${pct}%"></span></div>
      <div class="quest-foot"><span class="quest-prog">${q.progress} / ${q.goal}</span>${btn}</div>
    </div>`;
  }).join('');
}

// 守燈進度（供答題頁 HUD 與里程碑卡共用）：今日答對、目標、還差幾題、是否已點燈。
export function getLanternProgress() {
  if (!ctx) return { todayCorrect: 0, goal: 10, remaining: 10, litToday: false, streak: 0 };
  const l = getLanternState(ctx.meta, today);
  return {
    todayCorrect: Math.min(l.todayCorrect, l.goal),
    goal: l.goal,
    remaining: Math.max(0, l.goal - l.todayCorrect),
    litToday: l.litToday,
    streak: l.streak,
  };
}

// 答題頁常駐 HUD：讓「今日守燈進度」與「本回合答對」在答題當下就看得到（首頁 meta-bar 被 in-quiz 藏起來）。
export function updateQuizHud() {
  const hud = $('quiz-hud');
  if (!hud || !ctx) return;
  const lp = getLanternProgress();
  $('quiz-hud-lantern').textContent = lp.litToday
    ? `🪔 長明燈已亮・守燈 ${lp.streak} 天`
    : `🪔 守燈 今日 ${lp.todayCorrect}/${lp.goal}（還差 ${lp.remaining} 題）`;
  const s = ctx.session || {};
  $('quiz-hud-session').textContent = `本回合 答對 ${s.correct || 0}/${s.total || 0}`;
}

// 首頁「寵物閣」入口：顯示主寵頭像、名號與境界；未選主寵則提示去挑。
export function refreshPetEntry() {
  if (!ctx) return;
  const sub = $('pet-entry-sub');
  const img = $('pet-entry-img');
  if (!sub) return;
  const active = listPets(ctx.meta).find((p) => p.active);
  if (active) {
    sub.textContent = `${active.displayName}・${active.level} 級出戰中`;
    if (img) img.src = `assets/web/pet-${active.id}.jpg`;
  } else {
    sub.textContent = '選一隻山海神獸出戰';
    if (img) img.src = 'assets/web/pet-baize.jpg';
  }
  const entry = $('btn-pet');
  if (entry) entry.classList.toggle('pet-entry--glow', (ctx.meta.daily.todayCorrect || 0) > 0);
}

// 答題後掃描新解鎖的神獸，發現身 toast 並存檔。
export function syncPets() {
  if (!ctx) return;
  const r = syncPetUnlocks(ctx.meta);
  if (r.events.length) {
    saveMeta(ctx.meta);
    renderEvents(r.events);
  }
}

export function bindDailyBox() {
  $('daily-box').addEventListener('click', () => {
    const r = openBox(ctx.meta, today);
    if (!r.reward) return;
    saveMeta(ctx.meta);
    let msg = `硯池${r.reward.glow}一閃，開出 ${r.reward.pearls} 顆字珠！`;
    if (r.reward.liuli) msg += `琉璃匣現世——「${r.reward.weekTitle}」`;
    toast(msg, 'box');
    refreshWidgets();
  });
}

/* ---------- 對戰接線 ---------- */

export function beginBattle() {
  const eff = ctx.omen ? ctx.omen.effect : {};
  const pet = getPetBattleMods(ctx.meta); // 主寵等級＋設備加成
  const cub = getCubBattleMods(ctx.meta); // 隨行稚靈被動（神獸融合）
  ctx.battle = createBattleContext(ctx.meta, {
    damageBonus: (eff.type === 'damageBonus' ? eff.value : 0) + pet.damageBonus + cub.damageBonus,
    freeEliminate: (eff.type === 'freeEliminate' ? 1 : 0) + pet.freeEliminate + cub.freeEliminate,
  });
  const state = createBattleStateEx(ctx.battle);
  showMolingLine(pickLine(getBond(ctx.meta).stage, 'open'));
  return state;
}

export const battleOver = (state) => isOverEx(state, ctx.battle);

// 每題渲染後呼叫：套用「排除錯誤選項」（明目日/奇遇古卷破損）。
export function applyEliminate(optionsEl, answer) {
  if (!ctx.battle) return;
  let count = takeEliminate(ctx.battle);
  if (count <= 0) return;
  const wrongs = [...optionsEl.querySelectorAll('button')].filter((b) => b.dataset.value !== answer);
  while (count > 0 && wrongs.length) {
    const i = Math.floor(Math.random() * wrongs.length);
    const btn = wrongs.splice(i, 1)[0];
    btn.classList.add('option--eliminated');
    btn.disabled = true;
    count -= 1;
  }
}

let molingTimer = 0;
export function showMolingLine(line) {
  const bubble = $('moling-bubble');
  bubble.textContent = line;
  bubble.hidden = false;
  clearTimeout(molingTimer);
  molingTimer = setTimeout(() => { bubble.hidden = true; }, 2600);
}

export function hideMolingBubble() {
  clearTimeout(molingTimer);
  $('moling-bubble').hidden = true;
}

/* ---------- 事件渲染 ---------- */

// 原本 3600/500ms：一連對觸發燈階/開匣/成就等多個事件時，佇列要 6–8 秒才清空，
// 玩家早就翻過 2、3 題（FEEDBACK_DELAY 只有 800ms），舊訊息還在飄。縮短兩者讓佇列跟得上答題節奏。
const TOAST_MS = 2400;
const TOAST_GAP = 220;
let toastQueue = [];
let toastPumping = false;

function toast(text, kind = '') {
  toastQueue.push({ text, kind });
  if (!toastPumping) pumpToasts();
}

// 對外的輕量通知（練習回合轉換等 UI 提示用），走同一組 toast 佇列。
export function notify(text, kind = '') { toast(text, kind); }

function pumpToasts() {
  const next = toastQueue.shift();
  if (!next) { toastPumping = false; return; }
  toastPumping = true;
  const el = document.createElement('div');
  el.className = `event-toast${next.kind ? ` event-toast--${next.kind}` : ''}`;
  el.textContent = next.text;
  $('event-toasts').appendChild(el);
  setTimeout(() => el.classList.add('is-out'), TOAST_MS);
  setTimeout(() => el.remove(), TOAST_MS + 400);
  setTimeout(pumpToasts, TOAST_GAP);
}

// 文氣/字珠不進 toast，改在題卡上飄小字，避免蓋過題目。
function floatText(text, kind) {
  const host = document.querySelector('#quiz-area .quiz-card');
  if (!host || $('quiz-area').hidden) return;
  const el = document.createElement('span');
  el.className = `meta-float meta-float--${kind}`;
  el.textContent = text;
  host.appendChild(el);
  setTimeout(() => el.remove(), 2000);
}

export function renderEvents(events) {
  for (const e of events || []) {
    const p = e.payload || {};
    switch (e.type) {
      case 'xpGained':      floatText(`＋${p.amount} 文氣`, 'xp'); break;
      case 'pearlEarned':
        floatText(`＋${p.amount} 珠`, 'pearl');
        if (p.capped) toast(`今日字珠已滿 ${DAILY_EARN_CAP}，明日再煉`);
        break;
      case 'levelUp':       toast(`開悟！晉升「${p.name}」——${p.blessing}`, 'levelup'); playLevelUp(); break;
      case 'purified':      break; // 靜默：進度已入帳，避免每題洗版
      case 'worldLetter':   toast(`墨界回信・${p.title}｜${p.text}`, 'letter'); break;
      case 'pearlForged':   toast(`煉成${p.gradeName}！`, 'forge'); break;
      case 'pearlDusted':   toast(p.message || '字珠蒙塵了…', 'dust'); break;
      case 'pearlPolished': toast(`擦亮了！${p.gradeName}復光`, 'forge'); break;
      case 'gradeUp':       toast(`字珠升階——${p.gradeName}！`, 'forge'); break;
      case 'encounter':
        toast(`奇遇「${p.name}」：${p.desc}`, 'encounter'); // 含字妖突襲（挑戰題由對戰 UI 插入下一題）
        break;
      case 'lanternLit':       toast(`長明燈亮了！${p.message}（守燈 ${p.streak} 天）`, 'lantern'); break;
      case 'lanternTierUp':    toast(`燈升階——「${p.name}」！`, 'lantern'); break;
      case 'lanternOut':
        toast(p.message, 'lantern');
        if (!p.softened) maybeOfferNoDamage(); // 首次斷燈歸零時問要不要開無傷模式（腰斬=已開，不問）
        break;
      case 'lanternMilestone': toast(`守燈 ${p.days} 天「${p.title}」＋${p.pearls} 珠`, 'milestone'); break;
      case 'charmUsed':        toast(p.message, 'charm'); break;
      case 'charmGranted':     toast(`獲得護珠符（現有 ${p.charms} 枚）`, 'charm'); break;
      case 'boxUnlocked':      toast('硯池墨匣浮現了——回首頁開匣！', 'box'); break;
      case 'achievement':
        toast(`成就「${p.name}」蓋章！＋${p.pearls} 珠${p.title ? `｜稱號「${p.title}」` : ''}`, 'achievement');
        break;
      case 'charmTriggered':   toast(p.message, 'charm'); break;
      case 'comboShielded':    toast(`連對被「${p.name}」保住了`, 'charm'); break;
      case 'artReady':         toast('墨氣圓滿，訣已可發！'); break;
      case 'doubleDamage':     toast(`潑墨重擊 ${p.dmg} 傷！`, 'battle'); break;
      case 'burst':            toast(`${p.gear}爆發 ${p.dmg} 傷！`, 'battle'); break;
      case 'reflect':          toast(`${p.gear}反彈 ${p.dmg} 傷`, 'battle'); break;
      case 'bondLine':         showMolingLine(p.line); break;
      case 'bondStageUp':      toast(`羈絆升階——「${p.stageName}」`, 'bond'); break;
      case 'petBondStageUp':   toast(`與寵物的羈絆升階——「${p.name}」`, 'pet'); break;
      case 'gift':
        if (p.type === 'story') { toast('墨靈贈禮：墨靈的身世小故事', 'bond'); showStoryOverlay(); }
        else toast(`墨靈贈禮：${p.desc}`, 'bond');
        break;
      case 'artUnlocked':      toast(`新訣解鎖「${p.name}」：${p.desc}`, 'levelup'); break;
      case 'petUnlocked':      toast(`山海神獸「${p.name}」現身入閣！去寵物閣選牠出戰`, 'pet'); break;
      default: break;
    }
  }
  refreshWidgets();
}

/* ---------- 戰報卷軸（結算卡＋分享文字） ---------- */

function shareText(s) {
  const lines = [
    `【字字珠璣・${s.mode === 'battle' ? '墨靈對戰' : '練習修行'}戰報】`,
    `${s.name}｜${s.rankName}｜守燈 ${s.lanternStreak} 天`,
    s.mode === 'battle' ? `結果：${s.won ? '小書生獲勝！' : '墨靈少女獲勝'}` : null,
    `答對 ${s.correct}/${s.total}（${s.accuracy}%）｜最佳連對 ${s.bestCombo}`,
    `文氣 +${s.xpGained}｜字珠 +${s.pearlsEarned}`,
    s.newAchievements && s.newAchievements.length
      ? `新成就：${s.newAchievements.map((a) => a.name).join('、')}` : null,
    `墨靈：「${s.molingLine}」`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function renderSummary(summary) {
  const s = summary;
  const overlay = $('summary-scroll');
  const card = $('summary-card');
  card.classList.toggle('summary-card--gold-frame', !!s.goldFrame);

  $('summary-title').textContent = s.mode === 'battle'
    ? (s.won ? '大　捷' : '惜　敗')
    : '修行戰報';

  const rows = [
    ['道號', `${s.name}・${s.rankName}`],
    ['答對', `${s.correct} / ${s.total}（${s.accuracy}%）`],
    ['最佳連對', `${s.bestCombo}`],
    ['文氣', `＋${s.xpGained}`],
    ['字珠', `＋${s.pearlsEarned}`],
    ['守燈', `${s.lanternStreak} 天`],
    ['羈絆', s.bondStage],
  ];
  // 回訪勾引：把最強的每日鉤子接在情緒最高點——明天回來讓長明燈連下去
  if (s.lanternStreak >= 1) {
    rows.push(['明日', `再來守燈，長明燈就連 ${s.lanternStreak + 1} 天了 🔥`]);
  } else {
    rows.push(['明日', '明天答對 10 題就能點亮長明燈，開啟守燈之路 🪔']);
  }
  if (s.newPearls && s.newPearls.length) rows.push(['煉成', `${s.newPearls.length} 顆字珠`]);
  if (s.newAchievements && s.newAchievements.length) {
    rows.push(['新成就', s.newAchievements.map((a) => a.name).join('、')]);
  }
  const body = $('summary-rows');
  body.innerHTML = '';
  for (const [k, v] of rows) {
    const row = document.createElement('div');
    row.className = 'summary-row';
    const kEl = document.createElement('span');
    kEl.className = 'summary-row__key';
    kEl.textContent = k;
    const vEl = document.createElement('span');
    vEl.className = 'summary-row__val';
    vEl.textContent = v;
    row.append(kEl, vEl);
    body.appendChild(row);
  }
  $('summary-moling').textContent = `墨靈：「${s.molingLine}」`;

  const copyBtn = $('summary-copy');
  copyBtn.textContent = '複製分享文字';
  copyBtn.onclick = async () => {
    const text = shareText(s);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copyBtn.textContent = '已複製！';
  };
  // 分享圖卡：只在破紀錄(以本場是否解鎖新成就當「稀有時刻」信號)或羈絆滿百時提供，避免每場都要存圖
  const shareCardBtn = $('summary-share-card');
  const hasNewAchievement = !!(s.newAchievements && s.newAchievements.length);
  if (shouldOfferShareCard(s, { newRecord: hasNewAchievement })) {
    shareCardBtn.hidden = false;
    shareCardBtn.textContent = '分享圖卡';
    shareCardBtn.onclick = async () => {
      const canvas = $('share-card-canvas');
      renderShareCard(canvas, s);
      const r = await exportShareCard(canvas);
      shareCardBtn.textContent = r.ok
        ? (r.method === 'clipboard' ? '已複製圖卡！' : '已下載圖卡！')
        : '存圖失敗，再試一次';
    };
  } else {
    shareCardBtn.hidden = true;
    shareCardBtn.onclick = null;
  }

  const close = () => closeOverlay(overlay);
  $('summary-close').onclick = close;
  // 結算後順路逛寵物閣：剛賺到的字珠馬上有地方花，也讓藏在「更多功能」裡的寵物閣被看見
  $('summary-pet').onclick = () => { close(); $('btn-pet').click(); };
  openOverlay(overlay, close);
  refreshWidgets();
}
