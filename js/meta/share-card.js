// M11 分享圖卡：Canvas 1080×1350 潑墨分享卡，依 summary.js 已組好的資料渲染。
// 只在「破紀錄」或「羈絆滿百（goldFrame）」兩種稀有時刻提供，避免變成每場都要存圖的干擾。
// 配色需與 css/style.css 的 --paper/--paper-hi/--ink/--gold-text/--gold-hi 保持一致（canvas 讀不到 CSS 變數，故寫死於此）。

const COLOR = {
  paper: '#f0e9d8',
  paperHi: '#f8f3e6',
  ink: '#2b3a4a',
  inkSoft: '#55636f',
  goldHi: '#e6c96a',
  goldText: '#7d5c0f',
};

const W = 1080;
const H = 1350;

// summary = buildBattleSummary/buildPracticeSummary 的回傳值；newRecord 由呼叫端自行比對「這場是否破紀錄」後傳入。
export function shouldOfferShareCard(summary, { newRecord = false } = {}) {
  if (!summary) return false;
  return summary.goldFrame === true || newRecord === true;
}

export function renderShareCard(canvas, summary) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COLOR.paperHi);
  bg.addColorStop(1, COLOR.paper);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (summary.goldFrame) {
    ctx.strokeStyle = COLOR.goldHi;
    ctx.lineWidth = 18;
    ctx.strokeRect(24, 24, W - 48, H - 48);
  }

  // 簡易潑墨角花：幾個半透明弧線疊出墨暈感，不追求逼真筆觸
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = COLOR.ink;
  for (const [cx, cy, r] of [[80, 80, 140], [W - 100, 60, 110], [60, H - 100, 120]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.ink;
  ctx.font = '700 56px serif';
  ctx.fillText(summary.name, W / 2, 220);

  ctx.fillStyle = COLOR.inkSoft;
  ctx.font = '400 34px serif';
  ctx.fillText(`${summary.rankName}・${summary.bondStage}`, W / 2, 280);

  ctx.fillStyle = COLOR.ink;
  ctx.font = '800 140px serif';
  ctx.fillText(`${summary.accuracy}%`, W / 2, 520);
  ctx.font = '400 36px serif';
  ctx.fillStyle = COLOR.inkSoft;
  ctx.fillText(`答對 ${summary.correct}/${summary.total}`, W / 2, 580);

  ctx.font = '700 44px serif';
  ctx.fillStyle = COLOR.goldText;
  ctx.fillText(`最長連對 ${summary.bestCombo}｜連燈 ${summary.lanternStreak} 天`, W / 2, 660);

  if (summary.molingLine) {
    ctx.font = '400 30px serif';
    ctx.fillStyle = COLOR.goldText;
    wrapText(ctx, `「${summary.molingLine}」`, W / 2, H - 140, W - 160, 42);
  }

  ctx.font = '400 26px serif';
  ctx.fillStyle = COLOR.inkSoft;
  ctx.fillText('字字珠璣', W / 2, H - 50);
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const chars = Array.from(text);
  let line = '';
  const lines = [];
  for (const ch of chars) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, startY + i * lineHeight));
}

// 輸出：優先寫入剪貼簿圖片，失敗則退回下載連結；兩者都不觸發額外權限提示。
export async function exportShareCard(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return { ok: false };
  try {
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return { ok: true, method: 'clipboard' };
    }
  } catch { /* 權限被拒或不支援，走下載備援 */ }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'zizizhuji-分享卡.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { ok: true, method: 'download' };
}
