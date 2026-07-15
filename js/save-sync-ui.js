// 跨裝置存檔同步 UI：本機代碼存 zizhu:saveCode（裝置層級設定，不進 zzj_meta schema）。
// 載入會覆蓋本機進度，採兩段式確認（不用瀏覽器原生 confirm()）。

import { generateCode, pushSave, pullSave } from './save-sync.js';
import { openOverlay, closeOverlay } from './overlay-a11y.js';

const $ = (id) => document.getElementById(id);
const CODE_KEY = 'zizhu:saveCode';
const SYNCED_KEY = 'zizhu:lastSyncedAt';

let getMeta = () => null;
let onLoaded = () => {};
let confirmingLoad = false;

function myCode() {
  let code = null;
  try { code = localStorage.getItem(CODE_KEY); } catch {}
  if (!code) {
    code = generateCode();
    try { localStorage.setItem(CODE_KEY, code); } catch {}
  }
  return code;
}

function lastSyncedText() {
  let ts = null;
  try { ts = Number(localStorage.getItem(SYNCED_KEY)); } catch {}
  if (!ts) return '尚未同步過';
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return '上次同步：剛剛';
  if (mins < 60) return `上次同步：${mins} 分鐘前`;
  return `上次同步：${Math.round(mins / 60)} 小時前`;
}

export function initSaveSyncUI(opts) {
  getMeta = opts.getMeta;
  onLoaded = opts.onLoaded || (() => {});
  $('btn-savesync').addEventListener('click', open);
  $('savesync-close').addEventListener('click', close);
  $('savesync-push').addEventListener('click', handlePush);
  $('savesync-pull').addEventListener('click', handlePull);
  $('savesync-code-input').addEventListener('input', resetPullConfirm);
  $('savesync-pull-cancel').addEventListener('click', resetPullConfirm);
}

function open() {
  if (!getMeta()) return;
  render();
  openOverlay($('savesync-overlay'), close);
}

function close() { closeOverlay($('savesync-overlay')); }

function render() {
  $('savesync-code').textContent = myCode();
  $('savesync-status').textContent = lastSyncedText();
  resetPullConfirm();
}

async function handlePush() {
  const meta = getMeta();
  if (!meta) return;
  const btn = $('savesync-push');
  btn.disabled = true;
  btn.textContent = '同步中…';
  const r = await pushSave(myCode(), meta);
  btn.disabled = false;
  if (r.ok) {
    try { localStorage.setItem(SYNCED_KEY, String(Date.now())); } catch {}
    btn.textContent = '同步到雲端';
    $('savesync-status').textContent = lastSyncedText();
  } else {
    btn.textContent = '同步到雲端';
    $('savesync-status').textContent = '連不上雲端，稍後再試';
  }
}

function resetPullConfirm() {
  confirmingLoad = false;
  $('savesync-pull').textContent = '載入';
  $('savesync-pull-cancel').hidden = true;
}

async function handlePull() {
  const code = $('savesync-code-input').value.trim().toUpperCase();
  if (!code) return;

  if (!confirmingLoad) {
    confirmingLoad = true;
    $('savesync-pull').textContent = '確定覆蓋本機進度？再按一次';
    $('savesync-pull-cancel').hidden = false;
    return;
  }

  const btn = $('savesync-pull');
  btn.disabled = true;
  btn.textContent = '載入中…';
  const r = await pullSave(code);
  btn.disabled = false;
  if (r.ok && r.data) {
    onLoaded(r.data);
  } else {
    resetPullConfirm();
    $('savesync-status').textContent = '找不到這組代碼的存檔，請確認代碼是否正確';
  }
}
