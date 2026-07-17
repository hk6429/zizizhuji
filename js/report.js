// 題目回報：題目有問題（洩題/答案錯/選項怪）時，一鍵送到老師 Telegram。
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const BASE = 'https://zizizhuji.pages.dev';
let currentEntry = null;

export function attachReportButton(entry) {
  currentEntry = entry;
  const btn = document.getElementById('report-btn');
  if (btn) btn.hidden = false;
}

function open() {
  const overlay = document.getElementById('report-overlay');
  if (!overlay || !currentEntry) return;
  document.getElementById('report-note').value = '';
  document.getElementById('report-msg').textContent = '';
  const goBtn = document.getElementById('report-go');
  goBtn.disabled = false;
  const close = () => closeOverlay(overlay);
  document.getElementById('report-cancel').onclick = close;
  goBtn.onclick = async () => {
    const msg = document.getElementById('report-msg');
    goBtn.disabled = true;
    msg.textContent = '送出中…';
    try {
      const r = await fetch(`${BASE}/api/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: currentEntry.id,
          question: currentEntry.question,
          options: currentEntry.options,
          answer: currentEntry.answer,
          note: document.getElementById('report-note').value,
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (body.ok) {
        msg.textContent = '已送出，謝謝回報！';
        setTimeout(close, 1200);
      } else {
        msg.textContent = body.error || '送出失敗，請稍後再試';
        goBtn.disabled = false;
      }
    } catch {
      msg.textContent = '網路異常，請稍後再試';
      goBtn.disabled = false;
    }
  };
  openOverlay(overlay, close);
}

export function initReportUI() {
  const btn = document.getElementById('report-btn');
  if (btn) btn.addEventListener('click', open);
}
