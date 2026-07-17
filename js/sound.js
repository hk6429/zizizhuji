// 簡易音效：Web Audio API 即時合成（不載外部音檔），答對／答錯／升階／連對各一組短音。
// 開關存 localStorage，預設開啟；AudioContext 要等第一次使用者手勢（點選項按鈕）才建立，避免瀏覽器擋自動播放。

const SOUND_KEY = 'zizhu:soundOn';

function soundOn() {
  try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; }
}

export function setSoundOn(on) {
  try { localStorage.setItem(SOUND_KEY, on ? '1' : '0'); } catch { /* 隱私模式下僅本次生效 */ }
}

export function isSoundOn() { return soundOn(); }

let ctx = null;
function getCtx() {
  if (!soundOn()) return null;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// freq/durMs 一組音符；gain 用線性/指數包絡避免破音的「喀」聲。
function tone(freq, startAt, durMs, type = 'sine', peakGain = 0.18) {
  const c = getCtx();
  if (!c) return;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = c.currentTime + startAt;
  const t1 = t0 + durMs / 1000;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t1);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t1 + 0.02);
}

export function playCorrect() {
  tone(660, 0, 90, 'triangle');
  tone(880, 0.08, 140, 'triangle');
}

export function playWrong() {
  tone(220, 0, 160, 'sawtooth', 0.12);
}

export function playCombo() {
  tone(784, 0, 70, 'triangle');
  tone(988, 0.06, 70, 'triangle');
  tone(1175, 0.12, 160, 'triangle');
}

export function playLevelUp() {
  tone(523, 0, 90, 'triangle');
  tone(659, 0.09, 90, 'triangle');
  tone(784, 0.18, 90, 'triangle');
  tone(1047, 0.27, 260, 'triangle');
}
