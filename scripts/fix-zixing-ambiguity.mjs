import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = new URL('../data/ziyin-zixing-junior.json', import.meta.url);
const entries = JSON.parse(execFileSync('git', ['show', 'HEAD:data/ziyin-zixing-junior.json'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }));
const byId = new Map(entries.map((entry) => [entry.id, entry]));
const changed = [];

function contextualize(id, context) {
  const entry = byId.get(id);
  if (!entry) throw new Error(`找不到題目：${id}`);
  entry.question = `${entry.question}（${context}）`;
  changed.push({ id, treatment: '補語境', detail: context });
}

function replaceText(id, replacements, detail) {
  const entry = byId.get(id);
  if (!entry) throw new Error(`找不到題目：${id}`);
  for (const [from, to] of replacements) {
    let count = 0;
    for (const key of ['question', 'answer', 'note']) {
      if (typeof entry[key] === 'string' && entry[key].includes(from)) {
        entry[key] = entry[key].replaceAll(from, to);
        count += 1;
      }
    }
    entry.options = entry.options.map((option) => {
      if (!option.includes(from)) return option;
      count += 1;
      return option.replaceAll(from, to);
    });
    if (count === 0) throw new Error(`${id} 找不到待替換內容：${from}`);
  }
  changed.push({ id, treatment: '換誘答', detail });
}

contextualize('zy-中-1637', '此處指假裝不知情，不是西式服裝');
contextualize('zy-中-1670', '此處寫的是噩耗傳來後悲痛大哭');
contextualize('zy-中-1675', '此處指用工具把緊閉的木箱扳開，不是敲擊箱面');
replaceText('zy-中-1715', [['糖', '唐']], '「糖類」本身是合法詞，改以不成詞的「唐類」作誘答');
replaceText('zy-中-1758', [['隕落', '損落'], ['隕', '損']], '「隕落」為教育部辭典收錄詞，改用「損落」');
replaceText('zy-中-1776', [['迴游', '揮游'], ['回游', '灰游']], '移除可成立的「迴游／回游」，改用不成詞誘答');
contextualize('zy-中-1779', '此處是古籍所稱的洪水，不是氣象學中的降水');
replaceText('zy-中-1785', [['凹', '娃']], '「凹地」可獨立成立，改用「娃地」');
replaceText('zy-中-1825', [['混濁', '困濁'], ['混', '困']], '「混濁」可成立，改用「困濁」');
contextualize('zy-中-1857', '故事寫的是山谷中的溪流，不是兩座山之間');
replaceText('zy-中-1945', [['幹', '杆']], '「樹幹」可成立，改用「樹杆」作誘答');
replaceText('zy-中-2002', [['挨過', '埃過']], '「挨過」可成立，改用「埃過」');

{
  const entry = byId.get('zy-中-2032');
  entry.anchor = ['涉'];
  entry.options = [
    '阿哲在聯絡簿抄錄「設及」。',
    '小美在聯絡簿輸入「涉及」。',
    '家豪在聯絡簿標示「攝及」。',
    '小安在聯絡簿寫下「躡及」。',
  ];
  entry.answer = entry.options[1];
  entry.question = '班會紀錄寫到此事牽涉多個社團，下列「涉及」的字形何者正確？';
  entry.note = '教育部辭典收錄的標準詞形為「涉及」，正字「涉」見字音字形錨定檔。【T3】';
  changed.push({ id: entry.id, treatment: '換誘答', detail: '移除日文新字體「摂取」，改考教育部標準詞形「涉及」' });
}

contextualize('zy-中-2042', '此處指用手把遮住視線的枝葉推到旁邊，不是剝除外皮');
contextualize('zy-中-2075', '句意是他誇耀自己的才華，不只是自我期許');
contextualize('zy-中-2093', '古文中的人物正在用惡言責罵對方，不是討論專門用語');
contextualize('zy-中-2099', '此處要表達事理最深奧、最根本的意義，不是表示確實如此');
contextualize('zy-中-2101', '臣子正向君王提出規勸，不是入宮求見');
contextualize('zy-中-2114', '此處描寫夜晚環境安靜平和，不是說沒有安寧日子');
contextualize('zy-中-2236', '此處採國語詞「阿嬤」稱呼祖母，不採方言音義相近的「阿媽」');
contextualize('zy-中-2289', '此處指圖書館中用來陳列書本的架子，不是書籍售價');
replaceText('zy-中-2298', [['桐林', '銅林']], '「桐林」可指油桐林，改用「銅林」');
replaceText('zy-中-2308', [['桔子', '佶子']], '「桔子」另有辭典用法，改用「佶子」');
contextualize('zy-中-2379', '便條開頭是在向師長問候，不是稱呼興趣相同的人');
contextualize('zy-中-2490', '通知內容是運動後拉傷人體組織，不是菜單上的雞肉');
contextualize('zy-中-2492', '稿件介紹的是中國五座名山，不是曆法中的五月');
replaceText('zy-中-2507', [['顛峰', '滇峰']], '「顛峰」有通行用例，改用「滇峰」');
replaceText('zy-中-2575', [['精', '晶']], '「精英」與「菁英」皆可成立，改用「晶英」');
replaceText('zy-中-2614', [['二心', '膩心'], ['二', '膩']], '「二心」與「貳心」皆可成立，改用「膩心」');
contextualize('zy-中-2657', '海報描述的是有人抬腳猛踢大門，不是把門拴住');
replaceText('zy-中-2660', [['糟', '躁']], '「糟蹋」與「蹧蹋」皆可成立，改用「躁蹋」');
contextualize('zy-中-2670', '體育課口令要求全身俯臥地面，不是按下快門拍照');
contextualize('zy-中-2706', '句意是工作完成後應得的金錢，不是為仇恨報復');
replaceText('zy-中-2746', [['刮風', '括風']], '「刮風」另有收錄用法，改用「括風」');
replaceText('zy-中-2760', [['糊', '湖']], '「糊口」另有通行用法，改用「湖口」');
contextualize('zy-中-2775', '簡牘寫的是尚未成年的小馬，不是載人的馬車');
replaceText('zy-中-2821', [['金雕', '金碉']], '「金雕」另有通行用法，改用「金碉」');
contextualize('zy-中-2857', '信中要表達由內心真誠感謝，不是位置居中或效忠之心');
replaceText('zy-中-2903', [['璀燦', '璀慘']], '「璀燦」有古今用例，改用「璀慘」');
contextualize('zy-中-2970', '申請表描述船隻在海上行進，不是兩個「行」字並列');
replaceText('zy-中-2974', [['艋甲', '艋岬'], ['甲', '岬']], '「艋甲」有地名沿用情形，改用「艋岬」');
contextualize('zy-中-2979', '公告要提醒餐後把圓形餐具送回回收區，不是描述體型');

{
  const entry = byId.get('zy-中-3003');
  entry.question = '冰雕展紀錄寫道：「室溫升高後，冰塊逐漸熔化成水。」此處寫的是固態冰變成液態，哪個字應訂正？';
  entry.note = '水由固態變液態應寫「融化」；「熔化」本身是合法詞，通常指金屬等受熱變液態。【T10】';
  changed.push({ id: entry.id, treatment: '補語境', detail: '以冰塊變水區分「融化」與「熔化」' });
}

contextualize('zy-中-3022', '兩段資料介紹的是有螯與毒刺的節肢動物，不是文章開頭的楔子');
replaceText('zy-中-3054', [['嘩然', '樺然'], ['嘩', '樺']], '「嘩然」與「譁然」皆有用例，改用「樺然」');

writeFileSync(path, `${JSON.stringify(entries)}\n`);
console.log(JSON.stringify({ changed: changed.length, changedIds: changed }, null, 2));
