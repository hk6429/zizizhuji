// 無傷模式一次性提示：第一次碰到低血警示或斷燈事件時，跳一張提示卡問要不要開啟無傷模式。
// 只問一次（不論選什麼都不再出現）；無傷模式已開啟時不問。

import { openOverlay, closeOverlay } from './overlay-a11y.js';

const PROMPTED_KEY = 'zizhu:noDamagePrompted';
const NODAMAGE_KEY = 'zizhu:noDamageMode';

let onEnable = null;

export function initNoDamagePrompt(cb) {
  onEnable = cb;
}

export function maybeOfferNoDamage() {
  try {
    if (localStorage.getItem(PROMPTED_KEY) === '1') return;
    if (localStorage.getItem(NODAMAGE_KEY) === '1') return;
    localStorage.setItem(PROMPTED_KEY, '1');
  } catch { return; }
  const overlay = document.getElementById('nodamage-overlay');
  if (!overlay) return;
  const close = () => closeOverlay(overlay);
  document.getElementById('nodamage-yes').onclick = () => {
    try { localStorage.setItem(NODAMAGE_KEY, '1'); } catch { /* 隱私模式下僅本次生效 */ }
    if (onEnable) onEnable();
    close();
  };
  document.getElementById('nodamage-no').onclick = close;
  openOverlay(overlay, close);
}
