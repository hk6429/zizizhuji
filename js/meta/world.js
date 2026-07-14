// M2 淨珠圖・墨界拯救：685 顆字珠世界進度、三域對映、12 封墨界回信＋終章。
// 淨化＝該題首次答對，不可逆；答錯不扣。

export const ZONES = [
  { id: 'yin', name: '字音谷' },
  { id: 'xing', name: '字形林' },
  { id: 'chengyu', name: '珠璣海' },
];

export const MILESTONE_LETTERS = [
  { id: 'yin-10', zone: 'yin', pct: 10, title: '初聞谷音', text: '字音谷口的濁霧散了一角，隱約聽見孩子跟著你唸出正確的讀音。' },
  { id: 'yin-30', zone: 'yin', pct: 30, title: '泉聲復鳴', text: '谷中泉水恢復了聲音，村童又能唸出正確的讀音了。' },
  { id: 'yin-60', zone: 'yin', pct: 60, title: '谷風清朗', text: '半座山谷亮了起來，唸書聲此起彼落，字妖再不敢靠近。' },
  { id: 'yin-100', zone: 'yin', pct: 100, title: '字音谷重光', text: '最後一縷濁墨散去，字音谷百聲齊鳴，全谷為你立了一座小碑。' },
  { id: 'xing-10', zone: 'xing', pct: 10, title: '林間初光', text: '字形林邊緣的枯枝抽出新芽，筆畫的紋路重新變得清晰。' },
  { id: 'xing-30', zone: 'xing', pct: 30, title: '枝葉舒展', text: '林中樹木挺直了，每片葉子上的字都寫回了正確的形狀。' },
  { id: 'xing-60', zone: 'xing', pct: 60, title: '綠蔭如蓋', text: '大半座林子綠意盎然，錯字妖被趕進了林子最深處。' },
  { id: 'xing-100', zone: 'xing', pct: 100, title: '字形林重光', text: '整座林海翻起綠浪，樹梢的字閃閃發光，錯字再無藏身之處。' },
  { id: 'chengyu-10', zone: 'chengyu', pct: 10, title: '海面微光', text: '珠璣海面浮出點點珠光，沉睡的成語開始甦醒。' },
  { id: 'chengyu-30', zone: 'chengyu', pct: 30, title: '珠光漸盛', text: '退潮後的沙灘上滿是發亮的字珠，拾珠的漁人唱起了歌。' },
  { id: 'chengyu-60', zone: 'chengyu', pct: 60, title: '碧波萬頃', text: '大海重現碧藍，成語如魚群躍出水面，濁墨節節敗退。' },
  { id: 'chengyu-100', zone: 'chengyu', pct: 100, title: '珠璣海重光', text: '海底寶庫大門敞開，四百多顆成語珠一齊放出光芒。' },
  { id: 'grand', zone: 'all', pct: 100, title: '珠璣寶典重光', text: '685 顆字珠全數歸位，寶典重光！墨界永遠記得「護典書生」的名字。' },
];

// 題目 → 域：chengyu bank 全部 id 以 cy- 開頭；ziyin bank 依 type 分谷/林。
export function zoneOf(entry) {
  if (typeof entry.id === 'string' && entry.id.startsWith('cy-')) return 'chengyu';
  return entry.type === '字形' ? 'xing' : 'yin';
}

export function purify(meta, questionId, zone) {
  const w = meta.world;
  if (w.purified.includes(questionId)) return { meta, newlyPurified: false };
  w.purified.push(questionId);
  if (w.byZone[zone] != null) w.byZone[zone] += 1;
  return { meta, newlyPurified: true };
}

export function getProgress(meta, totals) {
  const w = meta.world;
  const total = (totals.yin || 0) + (totals.xing || 0) + (totals.chengyu || 0);
  const byZone = {};
  for (const z of ZONES) {
    const zTotal = totals[z.id] || 0;
    const done = w.byZone[z.id] || 0;
    byZone[z.id] = {
      name: z.name,
      done,
      total: zTotal,
      pct: zTotal > 0 ? Math.floor((done / zTotal) * 100) : 0,
    };
  }
  return { total, done: w.purified.length, byZone };
}

export function pendingMilestones(meta, totals) {
  const { total, done, byZone } = getProgress(meta, totals);
  const seen = meta.world.milestonesSeen;
  const out = [];
  for (const letter of MILESTONE_LETTERS) {
    if (seen.includes(letter.id)) continue;
    if (letter.id === 'grand') {
      if (total > 0 && done >= total) out.push(letter);
    } else if (byZone[letter.zone].total > 0 && byZone[letter.zone].pct >= letter.pct) {
      out.push(letter);
    }
  }
  return out;
}

export function markMilestoneSeen(meta, milestoneId) {
  if (!meta.world.milestonesSeen.includes(milestoneId)) {
    meta.world.milestonesSeen.push(milestoneId);
  }
  return meta;
}
