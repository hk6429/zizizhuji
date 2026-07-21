// 天下文氣榜（全服）：所有玩家共用一張榜，以文氣 XP 排名、前 500，把分數映成境界名顯示。
// 後端 = 自家 CF Pages Function + D1（見 functions/api/lb-*.js）；只有 pages.dev 那條線有後端，
// 另兩個靜態鏡像會靜默顯示「無法連線」提示，不影響本體遊玩。暱稱沿用班級榜綽號（隱私一致）。
import { openOverlay, closeOverlay } from './overlay-a11y.js';
import { fetchGlobal } from './leaderboard.js';
import { rankForXp } from './meta/progress.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function initTianxia({ getMeta }) {
  const btn = $('btn-tianxia');
  const overlay = $('tianxia-overlay');
  const closeBtn = $('tianxia-close');
  if (!btn || !overlay) return;

  btn.addEventListener('click', openBoard);
  if (closeBtn) closeBtn.addEventListener('click', () => closeOverlay(overlay));

  async function openBoard() {
    const meta = getMeta && getMeta();
    const myNick = String(meta?.selfstudy?.nick || '').trim();
    const myXp = meta?.xp?.value || 0;
    const listEl = $('tianxia-list');
    const selfEl = $('tianxia-self');

    listEl.innerHTML = '<li class="tx-empty">榜單載入中…</li>';
    selfEl.textContent = '';
    openOverlay(overlay, () => closeOverlay(overlay));

    const res = await fetchGlobal();
    if (!res.ok) {
      listEl.innerHTML = '<li class="tx-empty">天下榜暫時無法連線。此鏡像站可能沒有後端，請到 <b>zizizhuji.pages.dev</b> 查看完整榜單。</li>';
      selfEl.innerHTML = myNick ? `你目前 ${rankForXp(myXp).name}・文氣 ${myXp}` : '';
      return;
    }

    const rows = res.top || [];
    if (!rows.length) {
      listEl.innerHTML = '<li class="tx-empty">天下榜還沒有人上榜。先去答題累積文氣，搶下第一柱長明燈！</li>';
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
      selfEl.innerHTML = '你還沒設暱稱——到「文氣爭鋒」設一個班級暱稱（記得用綽號、別填真名），就能上天下榜。';
    } else if (myRank >= 0) {
      selfEl.innerHTML = `你（${esc(myNick)}）目前第 <b>${myRank + 1}</b> 名・${myRealm}・文氣 ${myXp}`;
    } else {
      selfEl.innerHTML = `你（${esc(myNick)}）目前 ${myRealm}・文氣 ${myXp}，還沒擠進前 500，繼續加油！`;
    }
  }
}
