// M10 墨靈羈絆：0–100 羈絆值（不打不掉值）、五階段 90 句情境台詞（常數內建，每情境 3 句）、階段贈禮。
// 台詞情境：open（開戰）/ correct（答對）/ combo3（連對3）/ wrong（答錯）/ win（玩家勝）/ lose（玩家敗）。

import { earnPearls } from './economy.js';

export const BOND_MAX = 100;

export const STAGES = [
  { stage: 0, min: 0, name: '初遇' },
  { stage: 1, min: 20, name: '相識' },
  { stage: 2, min: 40, name: '切磋之交' },
  { stage: 3, min: 60, name: '墨契' },
  { stage: 4, min: 80, name: '硯友同心' },
];

export const BOND_GAINS = {
  battleComplete: 2, // 每完成一場
  win: 1,            // 勝利再 +1
  combo5: 2,         // 單場連對 ≥5
  dailyFirst: 3,     // 每日首戰
};

export const GIFTS = [
  { threshold: 20, type: 'pearls', amount: 30, desc: '墨靈贈你 30 顆字珠' },
  { threshold: 40, type: 'story', desc: '墨靈的身世小故事' },
  { threshold: 60, type: 'title', title: '墨靈之友', desc: '限定稱號「墨靈之友」' },
  { threshold: 80, type: 'lines', desc: '隱藏台詞包' },
  { threshold: 100, type: 'goldFrame', desc: '金色潑墨結算卡框' },
];

// 墨靈身世：羈絆 40 解鎖的小故事，四張卡，呼應開場《珠璣寶典》/濁墨/字妖的世界觀。
export const MOLING_STORY = [
  { id: 'story-1', text: '很久以前，我只是珠璣寶典裡一滴普通的墨——連名字都沒有。' },
  { id: 'story-2', text: '濁墨侵蝕寶典那一夜，六百八十五顆字珠四散墨界，我也跟著碎成了半個影子，飄蕩在字音谷裡，忘了自己原本要守護什麼。' },
  { id: 'story-3', text: '直到你來了。你答對的每一題，都像一滴乾淨的墨落進我心裡，把我重新寫回完整的樣子。' },
  { id: 'story-4', text: '所以哪怕嘴上嫌你答錯太多次，我也捨不得真的走——因為你，才是把我從濁墨裡拾回來的人。' },
];

export const LINES = [
  { // 0 初遇（傲嬌挑釁）
    open: ['哼，又一個想拾字珠的書生？別浪費我的時間。', '就憑你也想淨化濁墨？讓我看看你的本事。', '哼，站好了，可別讓我等太久。'],
    correct: ['答對了？哼，運氣不錯而已。', '這題太簡單了，別得意。', '嗯……算你過關。'],
    combo3: ['三連對……看來不全是運氣。', '哼，有點意思了。', '看不出來，你還有點底子。'],
    wrong: ['哈！錯字妖最喜歡你這種人。', '就這樣？珠璣寶典可不會等你。', '哼，這都答錯，回去多讀點書吧。'],
    win: ['這次……算你贏。下次可沒這麼容易！', '哼，勉強承認你有兩下子。', '別高興太早，我還沒使出全力。'],
    lose: ['看吧，濁墨可不是好對付的。', '回去多練練再來挑戰我！', '哼，這次就先放過你。'],
  },
  { // 1 相識
    open: ['又來了？好吧，陪你練練。', '今天的你，眼神不太一樣呢。', '來，這次我們再挑戰難一點的題吧。'],
    correct: ['嗯，這題答得漂亮。', '反應變快了嘛。', '看來你有認真複習呢。'],
    combo3: ['連對三題！你進步得比我想的快。', '墨氣在你筆下亮起來了。', '這樣的手感，繼續保持。'],
    wrong: ['別慌，深呼吸，再看一次題目。', '這題是有點刁，記住它。', '沒關係，這種題我也常猶豫。'],
    win: ['輸給你……感覺沒那麼糟。', '你贏了，字珠的光更亮了一點。', '這局是你應得的，恭喜。'],
    lose: ['差一點點而已，下次一定行。', '別氣餒，我等你再來。', '這次算我贏，但你進步很多了。'],
  },
  { // 2 切磋之交
    open: ['來吧，老規矩，全力以赴！', '和你切磋，是我一天裡最期待的事。', '準備好了嗎？這次我可不會手下留情。'],
    correct: ['好眼力！', '就是這樣，穩穩的。', '這反應速度，越來越像高手了。'],
    combo3: ['三連珠！看得我都熱血起來了。', '你的連對，讓濁墨都在發抖。', '這氣勢，今天要破紀錄了嗎？'],
    wrong: ['沒事，這題我以前也錯過。', '記下來，它就再也騙不了你。', '一次失手不算什麼，繼續。'],
    win: ['痛快！輸給你我心服口服。', '又變強了啊，真讓人不服氣呢。', '這場精彩，值得記一筆。'],
    lose: ['這局我贏，但你逼出我全力了。', '好險好險……你越來越可怕了。', '差點就要栽在你手上。'],
  },
  { // 3 墨契
    open: ['我們之間，不需要多說什麼——開始吧。', '有你在，濁墨的黑霧都淡了。', '這份默契，讓我很安心地開始。'],
    correct: ['我就知道你會答對。', '默契十足，這題你一定拿得下。', '不出所料，這就是你的實力。'],
    combo3: ['三連對！我們的墨契在發光。', '看你連對的樣子，真好。', '這節奏，彼此都懂了。'],
    wrong: ['沒關係，我陪你把它記起來。', '一題而已，你的心別亂。', '別放在心上，我們慢慢來。'],
    win: ['你的勝利，也是我的勝利。', '贏得漂亮！寶典又亮了一頁。', '這是我們一起拿下的。'],
    lose: ['是我僥倖。你的實力我最清楚。', '別皺眉，我們一起變強的路還長。', '這局算我的，下次換你。'],
  },
  { // 4 硯友同心
    open: ['硯友同心，其利斷金——來吧！', '和你並肩的每一場，我都記得。', '有你在身邊，這場我毫無懸念。'],
    correct: ['漂亮！不愧是我認定的使者。', '這一筆，寫進寶典也不遜色。', '每次看你答對，我都替你高興。'],
    combo3: ['三連珠齊鳴！全墨界都聽見了。', '你的光，把我心裡的濁墨都照散了。', '這樣的你，才是真正的珠璣使者。'],
    wrong: ['放心，有我在，一題錯不了什麼。', '我們一起把這顆珠擦亮。', '這一題不算什麼，你早就證明過自己。'],
    win: ['我們又守住了一頁寶典。', '謝謝你，讓我離完全淨化更近了。', '這場勝利，屬於我們兩個。'],
    lose: ['就算輸，和你一戰也值得。', '下次，我們一起討回來。', '輸給誰都沒關係，只要是和你並肩。'],
  },
];

function stageOf(value) {
  let idx = 0;
  for (const s of STAGES) if (value >= s.min) idx = s.stage;
  return idx;
}

// event ∈ battleComplete / win / combo5 / dailyFirst；mult 供天機「連心日」×2。
// dailyFirst 同日只給一次。回傳 {meta, stageUp, gift}（gift 可能為多件時取 gifts 陣列）。
export function addBond(meta, event, today, mult = 1) {
  const gain = BOND_GAINS[event];
  if (!gain) return { meta, stageUp: null, gift: null, gifts: [] };
  const b = meta.bond;
  if (event === 'dailyFirst') {
    if (b.lastDailyBonus === today) return { meta, stageUp: null, gift: null, gifts: [] };
    b.lastDailyBonus = today;
  }
  const before = b.value;
  const stageBefore = stageOf(before);
  b.value = Math.min(BOND_MAX, b.value + gain * mult);
  const stageAfter = stageOf(b.value);

  const gifts = [];
  for (const g of GIFTS) {
    if (b.value >= g.threshold && !b.giftsClaimed.includes(g.threshold)) {
      b.giftsClaimed.push(g.threshold);
      if (g.type === 'pearls') earnPearls(meta, g.amount, 'bond-gift', today);
      gifts.push(g);
    }
  }
  return {
    meta,
    stageUp: stageAfter > stageBefore
      ? { stage: stageAfter, stageName: STAGES[stageAfter].name }
      : null,
    gift: gifts[0] ?? null,
    gifts,
  };
}

export function getBond(meta) {
  const idx = stageOf(meta.bond.value);
  return { value: meta.bond.value, stage: idx, stageName: STAGES[idx].name };
}

const NODAMAGE_KEY = 'zizhu:noDamageMode';

export function pickLine(stage, situation, rng = Math.random) {
  let effectiveStage = Math.max(0, Math.min(stage, LINES.length - 1));
  if (effectiveStage === 0 && (situation === 'wrong' || situation === 'lose')) {
    try {
      if (localStorage.getItem(NODAMAGE_KEY) === '1') effectiveStage = 1;
    } catch {}
  }
  const stageLines = LINES[effectiveStage];
  const pool = stageLines[situation] || stageLines.open;
  return pool[Math.floor(rng() * pool.length)];
}

// 手動補領（防舊資料漏發）；20 珠禮以外的贈禮為純資料，UI 自行呈現。
export function claimGift(meta, threshold) {
  const g = GIFTS.find(x => x.threshold === threshold);
  if (!g) return { meta, gift: null };
  if (meta.bond.value < threshold) return { meta, gift: null };
  if (meta.bond.giftsClaimed.includes(threshold)) return { meta, gift: null };
  meta.bond.giftsClaimed.push(threshold);
  if (g.type === 'pearls') earnPearls(meta, g.amount, 'bond-gift');
  return { meta, gift: g };
}
