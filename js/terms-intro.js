// 修行小抄：字珠/文氣/守燈 三個核心術語解說。
// 首次進站（誓言卡收掉後）自動彈一次，之後點 meta-bar 的「？」隨時可看。

import { openOverlay, closeOverlay } from './overlay-a11y.js';

const TERMS_SEEN_KEY = 'zizhu:termsIntroSeen';
const $ = (id) => document.getElementById(id);

const closeTerms = () => closeOverlay($('terms-overlay'));
export const openTerms = () => openOverlay($('terms-overlay'), closeTerms);

export function initTermsHelp() {
  $('terms-help').addEventListener('click', openTerms);
  $('terms-close').addEventListener('click', closeTerms);
}

// 誓言卡（或迎接卡）還開著就先不疊，等它收掉再由呼叫端補叫一次。
export function maybeShowTermsIntro() {
  let seen = false;
  try { seen = localStorage.getItem(TERMS_SEEN_KEY) === '1'; } catch {}
  if (seen) return;
  if (!$('oath-overlay').hidden || !$('welcomeback-overlay').hidden) return;
  try { localStorage.setItem(TERMS_SEEN_KEY, '1'); } catch {}
  openTerms();
}
