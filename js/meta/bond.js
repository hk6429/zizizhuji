// M10 墨靈羈絆：0–100 羈絆值（不打不掉值）、五階段 60 句情境台詞（常數內建）、階段贈禮。
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

export const LINES = [
  { // 0 初遇（傲嬌挑釁）
    open: ['哼，又一個想拾字珠的書生？別浪費我的時間。', '就憑你也想淨化濁墨？讓我看看你的本事。'],
    correct: ['答對了？哼，運氣不錯而已。', '這題太簡單了，別得意。'],
    combo3: ['三連對……看來不全是運氣。', '哼，有點意思了。'],
    wrong: ['哈！錯字妖最喜歡你這種人。', '就這樣？珠璣寶典可不會等你。'],
    win: ['這次……算你贏。下次可沒這麼容易！', '哼，勉強承認你有兩下子。'],
    lose: ['看吧，濁墨可不是好對付的。', '回去多練練再來挑戰我！'],
  },
  { // 1 相識
    open: ['又來了？好吧，陪你練練。', '今天的你，眼神不太一樣呢。'],
    correct: ['嗯，這題答得漂亮。', '反應變快了嘛。'],
    combo3: ['連對三題！你進步得比我想的快。', '墨氣在你筆下亮起來了。'],
    wrong: ['別慌，深呼吸，再看一次題目。', '這題是有點刁，記住它。'],
    win: ['輸給你……感覺沒那麼糟。', '你贏了，字珠的光更亮了一點。'],
    lose: ['差一點點而已，下次一定行。', '別氣餒，我等你再來。'],
  },
  { // 2 切磋之交
    open: ['來吧，老規矩，全力以赴！', '和你切磋，是我一天裡最期待的事。'],
    correct: ['好眼力！', '就是這樣，穩穩的。'],
    combo3: ['三連珠！看得我都熱血起來了。', '你的連對，讓濁墨都在發抖。'],
    wrong: ['沒事，這題我以前也錯過。', '記下來，它就再也騙不了你。'],
    win: ['痛快！輸給你我心服口服。', '又變強了啊，真讓人不服氣呢。'],
    lose: ['這局我贏，但你逼出我全力了。', '好險好險……你越來越可怕了。'],
  },
  { // 3 墨契
    open: ['我們之間，不需要多說什麼——開始吧。', '有你在，濁墨的黑霧都淡了。'],
    correct: ['我就知道你會答對。', '默契十足，這題你一定拿得下。'],
    combo3: ['三連對！我們的墨契在發光。', '看你連對的樣子，真好。'],
    wrong: ['沒關係，我陪你把它記起來。', '一題而已，你的心別亂。'],
    win: ['你的勝利，也是我的勝利。', '贏得漂亮！寶典又亮了一頁。'],
    lose: ['是我僥倖。你的實力我最清楚。', '別皺眉，我們一起變強的路還長。'],
  },
  { // 4 硯友同心
    open: ['硯友同心，其利斷金——來吧！', '和你並肩的每一場，我都記得。'],
    correct: ['漂亮！不愧是我認定的使者。', '這一筆，寫進寶典也不遜色。'],
    combo3: ['三連珠齊鳴！全墨界都聽見了。', '你的光，把我心裡的濁墨都照散了。'],
    wrong: ['放心，有我在，一題錯不了什麼。', '我們一起把這顆珠擦亮。'],
    win: ['我們又守住了一頁寶典。', '謝謝你，讓我離完全淨化更近了。'],
    lose: ['就算輸，和你一戰也值得。', '下次，我們一起討回來。'],
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
