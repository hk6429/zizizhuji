// 稚靈名片：Canvas 1080×1350 潑墨卡（仿 share-card.js 版式與配色）。
// 資料一律來自 fusion-store buildCubCardData；本檔只畫圖。
// 輸出重用 share-card.js 的 exportShareCard（剪貼簿優先、下載備援）。

export { exportShareCard } from './meta/share-card.js';

const COLOR = {
  paper: '#f0e9d8', paperHi: '#f8f3e6', ink: '#2b3a4a',
  inkSoft: '#55636f', goldHi: '#e6c96a', goldText: '#7d5c0f',
};
const W = 1080;
const H = 1350;

export function renderCubCard(canvas, d) {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, COLOR.paperHi);
  bg.addColorStop(1, COLOR.paper);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = COLOR.goldHi;
  ctx.lineWidth = 14;
  ctx.strokeRect(24, 24, W - 48, H - 48);

  // 潑墨角花（同 share-card.js 手法）
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = COLOR.ink;
  for (const [cx, cy, r] of [[80, 80, 140], [W - 100, 60, 110], [60, H - 100, 120]]) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = COLOR.goldText;
  ctx.font = '400 34px serif';
  ctx.fillText(`「${d.title}」`, W / 2, 180);
  ctx.fillStyle = COLOR.ink;
  ctx.font = '700 84px serif';
  ctx.fillText(d.displayName, W / 2, 280);
  if (d.displayName !== d.name) {
    ctx.font = '400 34px serif';
    ctx.fillStyle = COLOR.inkSoft;
    ctx.fillText(`（${d.name}）`, W / 2, 330);
  }

  // 立繪：載入成功畫圖、失敗畫墨團剪影（美術未到位前的佔位）
  const img = new Image();
  img.onload = () => { ctx.drawImage(img, W / 2 - 260, 380, 520, 520); drawFooter(); };
  img.onerror = () => {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = COLOR.ink;
    ctx.beginPath(); ctx.arc(W / 2, 640, 240, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = COLOR.paperHi;
    ctx.font = '700 120px serif';
    ctx.fillText('？', W / 2, 685);
    drawFooter();
  };
  img.src = d.imgSrc;

  function drawFooter() {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLOR.ink;
    ctx.font = '700 40px serif';
    const [pa, pb] = d.parents;
    ctx.fillText(`${pa.name} × ${pb.name} 血脈修復`, W / 2, 1010);
    ctx.fillStyle = COLOR.inkSoft;
    ctx.font = '400 32px serif';
    ctx.fillText(`${d.category}系稚靈${d.passiveName ? `｜被動「${d.passiveName}」` : ''}｜稚靈 ${d.cubCount}/6`, W / 2, 1070);
    ctx.fillStyle = COLOR.goldText;
    ctx.font = '400 30px serif';
    ctx.fillText(d.desc, W / 2, 1150);
    ctx.fillStyle = COLOR.inkSoft;
    ctx.font = '400 26px serif';
    ctx.fillText('字字珠璣・神獸融合', W / 2, H - 50);
  }
}
