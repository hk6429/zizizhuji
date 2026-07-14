import { writeFileSync } from 'node:fs';
import { pickCharDistractors } from '../js/distractor.js';

// Source: 103年全國語文競賽國小學生組字音字形試題與解答
// PDF: https://www.takes.ntpc.edu.tw (103小生組全國賽解答.pdf)
// Manually verified against official answer-key PDF page images (2026-07-14).

const ZIYIN = [
  // [word, targetChar, reading]
  ['魚拓', '拓', 'ㄊㄚˋ'],
  ['鐫刻', '鐫', 'ㄐㄩㄢ'],
  ['鵠的', '鵠', 'ㄍㄨˇ'],
  ['訛舛', '舛', 'ㄔㄨㄢˇ'],
  ['螻蟻', '螻', 'ㄌㄡˊ'],
  ['顴骨', '顴', 'ㄑㄩㄢˊ'],
  ['地塹', '塹', 'ㄑㄧㄢˋ'],
  ['經綸', '綸', 'ㄌㄨㄣˊ'],
  ['羞赧', '赧', 'ㄋㄢˇ'],
  ['傀儡', '傀', 'ㄎㄨㄟˇ'],
  ['椪柑', '椪', 'ㄆㄥˋ'],
  ['米芾', '芾', 'ㄈㄨˊ'],
];

const ZIXING = [
  // [word, targetChar, reading-clue]
  ['擤鼻涕', '擤', 'ㄒㄧㄥˋ'],
  ['優酪乳', '酪', 'ㄌㄠˋ'],
  ['蔥薑蒜', '薑', 'ㄐㄧㄤ'],
  ['向日葵', '葵', 'ㄎㄨㄟˊ'],
  ['冒牌貨', '冒', 'ㄇㄠˋ'],
  ['轉捩點', '捩', 'ㄌㄧㄝˋ'],
  ['全壘打', '壘', 'ㄌㄟˇ'],
  ['金龜婿', '龜', 'ㄍㄨㄟ'],
  ['閻羅王', '閻', 'ㄧㄢˊ'],
  ['盥洗室', '盥', 'ㄍㄨㄢˋ'],
  ['打牙祭', '祭', 'ㄐㄧˋ'],
  ['光碟機', '碟', 'ㄉㄧㄝˊ'],
  ['踢毽子', '毽', 'ㄐㄧㄢˋ'],
  ['骯髒鬼', '骯', 'ㄤ'],
  ['高聳神木', '聳', 'ㄙㄨㄥˇ'],
  ['探索頻道', '頻', 'ㄆㄧㄣˊ'],
];

const YEAR = 103;
const SOURCE = '103年全國語文競賽國小學生組字音字形試題（官方解答）';

const bank = [];

// 字音: pool = all readings in ZIYIN list (same year, same type)
const ziyinPool = ZIYIN.map(([, , reading]) => reading);
ZIYIN.forEach(([word, char, reading], i) => {
  const distractors = pickCharDistractors(reading, ziyinPool, 3);
  const options = [reading, ...distractors].sort(() => Math.random() - 0.5);
  bank.push({
    id: `zy-${YEAR}-${String(i + 1).padStart(3, '0')}`,
    level: '國小',
    year: YEAR,
    source: SOURCE,
    type: '字音',
    question: `「${word}」的「${char}」正確讀音是？`,
    options,
    answer: reading,
    note: '',
  });
});

// 字形: pool = all target characters in ZIXING list (same year, same type)
const zixingPool = ZIXING.map(([, char]) => char);
ZIXING.forEach(([word, char, reading], i) => {
  const distractors = pickCharDistractors(char, zixingPool, 3);
  const options = [char, ...distractors].sort(() => Math.random() - 0.5);
  const blanked = word.replace(char, '○');
  bank.push({
    id: `zx-${YEAR}-${String(i + 1).padStart(3, '0')}`,
    level: '國小',
    year: YEAR,
    source: SOURCE,
    type: '字形',
    question: `「${blanked}」（讀音${reading}）正確用字是？`,
    options,
    answer: char,
    note: '',
  });
});

writeFileSync(
  new URL('../data/ziyin-zixing-elementary.json', import.meta.url),
  JSON.stringify(bank, null, 2) + '\n'
);

console.log(`Wrote ${bank.length} entries.`);
