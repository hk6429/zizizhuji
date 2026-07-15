// 共用 overlay 無障礙輔助：開啟鎖焦點／Tab 循環、Esc 關閉、關閉後焦點歸還觸發元件。
const openStack = [];

function focusablesOf(el) {
  return Array.from(el.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )).filter((n) => !n.disabled && n.offsetParent !== null);
}

function trapKeydown(e, overlay, onEsc) {
  if (e.key === 'Escape') { e.preventDefault(); onEsc(); return; }
  if (e.key !== 'Tab') return;
  const items = focusablesOf(overlay);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

// onEsc：Esc 鍵按下時呼叫的關閉函式（通常與關閉按鈕相同邏輯）
export function openOverlay(overlay, onEsc) {
  overlay.hidden = false;
  const returnEl = document.activeElement;
  const items = focusablesOf(overlay);
  (items[0] || overlay).focus({ preventScroll: true });
  const handler = (e) => trapKeydown(e, overlay, onEsc);
  overlay.addEventListener('keydown', handler);
  openStack.push({ overlay, returnEl, handler });
}

export function closeOverlay(overlay) {
  overlay.hidden = true;
  const idx = openStack.findIndex((s) => s.overlay === overlay);
  if (idx === -1) return;
  const { returnEl, handler } = openStack[idx];
  overlay.removeEventListener('keydown', handler);
  openStack.splice(idx, 1);
  if (returnEl && document.body.contains(returnEl)) returnEl.focus({ preventScroll: true });
}
