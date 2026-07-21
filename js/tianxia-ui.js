// 天下文氣榜（全服）：所有玩家共用一張榜，以文氣 XP 排名、前 500，把分數映成境界名顯示。
// 後端 = 自家 CF Pages Function + D1（見 functions/api/lb-*.js）；只有 pages.dev 那條線有後端，
// 另兩個靜態鏡像會靜默顯示「無法連線」提示，不影響本體遊玩。
// 暱稱獨立於班級：在本面板即可設綽號上榜，不必先加入班級（沿用同一 meta.selfstudy.nick）。
import { openOverlay, closeOverlay } from './overlay-a11y.js';
import { fetchGlobal, submitGlobalXp } from './leaderboard.js';
import { rankForXp } from './meta/progress.js';
import { saveMeta } from './meta/store.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const NICK_MAX = 12;

export function initTianxia({ getMeta }) {
  const btn = $('btn-tianxia');
  const overlay = $('tianxia-overlay');
  const closeBtn = $('tianxia-close');
  const nickInput = $('tianxia-nick');
  const nickSave = $('tianxia-nick-save');
  if (!btn || !overlay) return;

  const curNick = () => String(getMeta?.()?.selfstudy?.nick || '').trim();

  btn.addEventListener('click', openBoard);
  if (closeBtn) closeBtn.addEventListener('click', () => closeOverlay(overlay));
  if (nickSave) nickSave.addEventListener('click', saveNick);
  if (nickInput) nickInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveNick(); });

  async function saveNick() {
    const meta = getMeta && getMeta();
    if (!meta) return;
    const n = String(nickInput.value || '').trim().slice(0, NICK_MAX);
    if (!n) { $('tianxia-self').textContent = '請先填一個綽號（1–12 字）再上榜。'; return; }
    meta.selfstudy.nick = n;
    saveMeta(meta);
    const xp = meta.xp?.value || 0;
    await submitGlobalXp(n, xp).catch(() => {});
    await renderBoard();
  }

  async function openBoard() {
    if (nickInput) nickInput.value = curNick();
    openOverlay(overlay, () => closeOverlay(overlay));
    await renderBoard();
  }

  async function renderBoard() {
    const meta = getMeta && getMeta();
    const myNick = curNick();
    const myXp = meta?.xp?.value || 0;
    const listEl = $('tianxia-list');
    const selfEl = $('tianxia-self');

    listEl.innerHTML = '<li class="tx-empty">榜單載入中…</li>';
    selfEl.textContent = '';

    const res = await fetchGlobal();
    if (!res.ok) {
      listEl.innerHTML = '<li class="tx-empty">天下榜暫時無法連線。此鏡像站可能沒有後端，請到 <b>zizizhuji.pages.dev</b> 查看完整榜單。</li>';
      selfEl.innerHTML = myNick ? `你目前 ${rankForXp(myXp).name}・文氣 ${myXp}` : '';
      return;
    }

    const rows = res.top || [];
    if (!rows.length) {
      listEl.innerHTML = '<li class="tx-empty">天下榜還沒有人上榜。設個綽號、去答題累積文氣，搶下第一柱長明燈！</li>';
    } else {
      listEl.innerHTML = rows.map((r, i) => {
        const realm = rankForXp(r.score).name;
        const mine = myNick && r.name === myNick ? ' tx-row--me' : '';
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1);
        return `<li class="tx-row${mine}">` +
          `<span class="tx-rank">${medal}</span>` +
          `<span class="tx-name">${esc(r.name)}</span>` +
          `<span class="tx-realm">${realm}</span>` +
          `<span class="tx-xp">文氣 ${r.score}</span></li>`;
      }).join('');
    }

    const myRealm = rankForXp(myXp).name;
    const myRank = myNick ? rows.findIndex((r) => r.name === myNick) : -1;
    if (!myNick) {
      selfEl.innerHTML = '在上方填個綽號（勿填真名）就能上天下榜——不必加入班級。';
    } else if (myRank >= 0) {
      selfEl.innerHTML = `你（${esc(myNick)}）目前第 <b>${myRank + 1}</b> 名・${myRealm}・文氣 ${myXp}`;
    } else {
      selfEl.innerHTML = `你（${esc(myNick)}）目前 ${myRealm}・文氣 ${myXp}，還沒擠進前 500，繼續加油！`;
    }
  }
}
