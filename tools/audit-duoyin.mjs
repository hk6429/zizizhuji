// 破音字全庫覆核：掃所有「字音」題，抓出「同一個字在不同題目被標成不同注音」的衝突候選。
// 目的＝供人工對《一字多音審訂表》複核（審訂表 88 年起廢除大量舊多音，辭典舊條目不代表現行標準）。
// 本腳本不改任何內容、不判對錯，只產出候選清單。真題(有 year)與自編分開標記——自編風險較高。
// 用法：node tools/audit-duoyin.mjs
import fs from 'node:fs';

const FILES = [
  'data/ziyin-zixing-elementary.json',
  'data/ziyin-zixing-junior.json',
];

// 從題幹擷取「被考的那個字」：優先 「詞」的「字」 句式，其次 「字」的讀音 句式。
function targetChar(q) {
  let m = q.question.match(/「[^」]{1,6}」的「(.)」/);
  if (m) return m[1];
  m = q.question.match(/「(.)」的(?:正確)?讀音/);
  if (m) return m[1];
  return null;
}

const byChar = new Map(); // char -> [{id, answer, year, origin}]
let scanned = 0, extracted = 0;

for (const f of FILES) {
  const arr = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const q of arr) {
    if (q.type !== '字音') continue;
    scanned++;
    const c = targetChar(q);
    if (!c) continue;
    extracted++;
    if (!byChar.has(c)) byChar.set(c, []);
    byChar.get(c).push({
      id: q.id,
      answer: q.answer,
      year: q.year || null,
      origin: q.year ? '官方真題' : '自編',
    });
  }
}

// 衝突＝同一字出現 ≥2 種不同 answer 注音
const conflicts = [];
for (const [c, list] of byChar) {
  const readings = [...new Set(list.map((x) => x.answer))];
  if (readings.length >= 2) conflicts.push({ char: c, readings, list });
}
// 含自編的衝突優先（自編對審訂表風險較高）
conflicts.sort((a, b) => {
  const aHas = a.list.some((x) => x.origin === '自編');
  const bHas = b.list.some((x) => x.origin === '自編');
  if (aHas !== bHas) return aHas ? -1 : 1;
  return b.readings.length - a.readings.length;
});

const lines = [];
lines.push('# 破音字全庫覆核：同字多音衝突候選');
lines.push('');
lines.push(`掃描字音題 ${scanned} 題，成功擷取目標字 ${extracted} 題；`);
lines.push(`偵測到 **${conflicts.length}** 個字在不同題目被標成不同注音（衝突候選，需人工對《一字多音審訂表》複核）。`);
lines.push('');
lines.push('> 注意：出現多音**不一定是錯**——審訂表保留部分字依詞義區分讀音（如「差」）。');
lines.push('> 本清單只是「請人親自查審訂表確認」的候選，不是判定為錯。含「自編」來源者優先複核。');
lines.push('');
for (const { char, readings, list } of conflicts) {
  const hasSelf = list.some((x) => x.origin === '自編');
  lines.push(`## ${char}　${readings.join(' / ')}${hasSelf ? '　⚠️含自編' : ''}`);
  for (const x of list) lines.push(`- ${x.answer}　${x.id}　(${x.origin}${x.year ? ' ' + x.year : ''})`);
  lines.push('');
}

fs.writeFileSync('tools/audit-duoyin-report.md', lines.join('\n'));
console.log(`衝突候選 ${conflicts.length} 字（含自編 ${conflicts.filter((c) => c.list.some((x) => x.origin === '自編')).length} 字）`);
console.log('報告：tools/audit-duoyin-report.md');
