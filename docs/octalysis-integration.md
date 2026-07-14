# 字字珠璣・八角機制層整合規格（給主控/整合工程師）

> 機制層已完工：`js/meta/` 全部 17 個模組、`test/meta/` 128 個單元測試全綠（`node --test`）。
> 本文件是**唯一接線說明**：app.js 哪個時點呼叫哪個函式、UI 要掛哪些新元素、事件怎麼渲染。
> 機制模組零 DOM、零 fetch；所有持久化只走一把 localStorage 鑰匙 `zzj_meta`。

---

## 0. 十秒總覽

```
app.js 只需要 import 一個 facade：
  import * as kernel from './meta/kernel.js';

四個呼叫點：
  1. 開站       → kernel.initSession(today, banks)
  2. 練習答一題 → kernel.onPracticeAnswer(ctx, id, correct)
  3. 對戰答一題 → kernel.onBattleAnswer(ctx, state, side, correct, id)
  4. 收尾       → kernel.onBattleEnd(ctx, state) / kernel.onPracticeEnd(ctx)

每個呼叫都回傳 events: {type, payload, fx}[] → 交給一個 renderEvents(events) 函式依 type 渲染。
```

戰鬥數值層（法寶／三訣／護符／奇遇 buff）已包在 kernel 內，但**戰鬥 state 的產生與推進要改用 adapter**（見 §3）。

---

## 1. 呼叫點一：開站（DOMContentLoaded 後、兩個題庫 fetch 完）

```js
import * as kernel from './meta/kernel.js';

const ziyinBank = await fetchBank('data/ziyin-zixing-elementary.json', 'ziyin');
const chengyuBank = await fetchBank('data/chengyu-elementary.json', 'chengyu');

const today = new Date().toLocaleDateString('sv');   // 'YYYY-MM-DD' 本地日期
const init = kernel.initSession(today, { ziyin: ziyinBank, chengyu: chengyuBank });
// init = { ctx, meta, intro, omen, lantern, pendingMilestones, polishTasks }
window.zzjCtx = init.ctx;   // ctx 全程共用一顆（練習與對戰都用它）
```

| 回傳欄位 | 型別 | UI 動作 |
|---|---|---|
| `intro` | `{cards:[3張], oaths:[4句]}` 或 `null` | 非 null → 播首訪攔截層 `#oath-overlay`：3 張敘事卡（`intro.cards[].text`）→ 第 3 卡列 4 顆誓言按鈕。玩家選定後呼叫 `oath.swearOath(init.meta, oathId, today)` ＋ `oath.markIntroSeen(init.meta)` ＋ `store.saveMeta(init.meta)`（三個都從 `./meta/oath.js`、`./meta/store.js` import）。可跳過：只 markIntroSeen。 |
| `omen` | `{omenId, name, desc, effect}` | 開站彈一張籤詩卡 `#omen-card`（名稱＋描述），同日重進不重抽（同日必回同一支籤，直接每次顯示即可，或用 sessionStorage 記已看過） |
| `lantern` | `{streak, tier, tierName, litToday, todayCorrect, goal, best, charms}` | 主畫面常駐 `#lantern-widget`：燈圖示（依 `tier` 換 4 階燈皮膚、`litToday` 亮/暗）＋文字「守燈 {streak} 天・今日 {todayCorrect}/{goal}」 |
| `pendingMilestones` | `Letter[]`（通常空，異常回補用） | 逐封彈 `#letter-modal`，關閉時呼叫 `world.markMilestoneSeen(meta, letter.id)` + saveMeta |
| `polishTasks` | `{id, remaining}[]` | 主畫面「擦亮任務」badge `#polish-badge`（數字＝任務數）；點開列出蒙塵題，點題直接進練習模式該題 |

另外在主畫面常駐（資料 getter 皆為純函式，隨時可呼叫）：

| 元素 id | 資料來源 | 內容 |
|---|---|---|
| `#pearl-balance` | `economy.getBalance(ctx.meta)` | 字珠餘額（頂欄） |
| `#rank-badge` | `progress.getProgress(ctx.meta)` | `rankName`（頭像旁）＋下一境進度條 `xp / nextThreshold` |
| `#world-ring` | `world.getProgress(ctx.meta, ctx.totals)` | 「墨界淨化 {done} / {total}」進度環＋三域分percent |
| `#oath-line` | `oath.getOath(ctx.meta, today)` | 標題下方常駐誓言列（`oathText`）；`canRenew` 為真時顯示「重立道心」小按鈕 |
| `#collection-count` | `collection.getCollection(ctx.meta)` | 「已集 {earned.length}/685」＋ `dustyCount` 蒙塵數 |

---

## 2. 呼叫點二：練習答完一題

現行 `startPractice()` 的改法（關鍵三行）：

```js
// (1) Leitner state 改由 kernel 的 ctx 供給（含上次遊玩的盒位，不再每次歸零）：
const state = ctx.leitner;              // 取代 createLeitnerState(ids)
// nextQuestionId(state, ids) 照舊可用 —— ctx.leitner 就是同構的 Map

// (2) 答完一題：把原本的 recordAnswer(state, id, correct) 整行「刪掉」，改成：
const { events } = kernel.onPracticeAnswer(ctx, id, value === entry.answer);
renderEvents(events);                   // (3) 事件渲染（見 §5）
// 注意：kernel 內部已呼叫 leitner.recordAnswer ＋持久化，app.js 不可再 recordAnswer（會重複計）
```

練習 session 結束（玩家按「離開」或答滿一輪）：

```js
const { summary } = kernel.onPracticeEnd(ctx);
renderSummary(summary);                 // 戰報卷軸（見 §4）
```

---

## 3. 呼叫點三：對戰

### 戰前（點「對戰模式」按鈕後、出題前）——裝備選擇頁 `#gear-page`

```js
import { GEAR_LIST, buyGear, setLoadout, getModifiers } from './meta/gear.js';
import { ARTS, equipArt } from './meta/arts.js';
import { saveMeta } from './meta/store.js';
```

- 商店＋loadout 同頁：`GEAR_LIST` 每件渲染一張卡（`name/category/price/desc`），`ctx.meta.gear.owned` 判斷已購（`.gear-card--owned`）、`ctx.meta.gear.loadout` 判斷已裝備（`.gear-card--equipped`，最多 2）。
- 購買 → `buyGear(ctx.meta, gearId)`；`reason==='pearls'` 時 toast「字珠不夠」。裝備 → `setLoadout(ctx.meta, [id1, id2])`。
- 三訣區：`ARTS` 三張卡，`ctx.meta.arts.unlocked` 沒有的顯示鎖＋「勝 {unlockWins} 場解鎖」；選定 → `equipArt(ctx.meta, artId)`。
- 離開此頁 `saveMeta(ctx.meta)` 一次。

### 開戰（取代 `createBattleState()`）

```js
import { createBattleStateEx, castArtEx, takeEliminate, isOverEx, applyHeal } from './meta/battle-adapter.js';

let state = null;   // 第一題答完後 kernel 會建 ctx.battle；state 先用 adapter 產生：
// 正確做法：先打一發 no-op 不行 —— 直接自己建 battle ctx 再產 state：
import { createBattleContext } from './meta/battle-adapter.js';
ctx.battle = createBattleContext(ctx.meta);       // kernel 會沿用這顆
state = createBattleStateEx(ctx.battle);           // 澄心紙 → hpA 120
```

開戰同時顯示墨靈開場白：`bond.pickLine(bond.getBond(ctx.meta).stage, 'open')` → `#moling-bubble`。

### 每題渲染前

```js
const eliminateCount = takeEliminate(ctx.battle);  // 點睛訣/古卷破損/明目日 累積的「排除錯誤選項」數
// eliminateCount > 0 → 隨機挑 N 個錯誤選項加 .option--eliminated（劃掉、不可點）
```

戰鬥 HUD 需要的新元素：

| 元素 id | 內容 |
|---|---|
| `#ink-gauge` | 墨氣條：`ctx.battle.art.ink` / 5，滿格發光（`artReady` 事件） |
| `#btn-cast-art` | 發動訣按鈕（顯示已裝備訣名）；點擊 → `castArtEx(ctx.battle)`，`ok:false` 則搖頭動畫；`effect.type==='eliminate'` 時立即對當前題呼叫 `takeEliminate` 重渲染選項 |
| `#combo-counter` | `state.comboA` 連對數（≥門檻時加 `.combo--hot`） |
| `#moling-bubble` | 墨靈對話泡泡（`bondLine` 事件） |

### 答完一題（雙方共用）

```js
const r = kernel.onBattleAnswer(ctx, state, side, correct, entry.id);  // side: 'A' 玩家 / 'B' 墨靈
state = r.state;
renderEvents(r.events);
if (isOverEx(state, ctx.battle)) endBattle();
```

- **不要再呼叫原 `applyAnswer`**——kernel 內部經 battle-adapter 呼叫它並疊加法寶/三訣/護符/奇遇。
- `entry.id` 一定要傳（淨化、Leitner、題型加傷都靠它）。
- 奇遇「字妖突襲」（`encounter` 事件、`payload.effect.type==='challenge'`）：UI 插入一題限時挑戰題，答對 → `state = applyHeal(state, 'A', payload.effect.healOnWin, ctx.battle)`，答錯無事。

### 戰後

```js
const { summary, events } = kernel.onBattleEnd(ctx, state);
renderEvents(events);        // artUnlocked / bondStageUp / gift / achievement
renderSummary(summary);      // 戰報卷軸 + 分享卡（§4）
```

---

## 4. 戰報卷軸與分享卡（`summary` 物件）

`summary` 欄位（battle / practice 共通再加各自欄位）：

```
name（道號，未設定＝'無名書生'）  rankName（境界）  lanternStreak（守燈天數）
bondStage（羈絆階段名）  goldFrame（bool，羈絆100 → 金色潑墨卡框）  seal（擂台頁蓋'珠王'用，預設 null）
mode  won  correct  total  accuracy  bestCombo  xpGained  pearlsEarned
newPearls（本場煉成珠）  newAchievements  purifiedCount  molingLine（墨靈評語一句）
```

- 結算彈層 `#summary-scroll`（卷軸展開動畫 `.scroll-unroll`）。
- 分享卡：Canvas 1080×1350，`goldFrame` 真 → 金框素材；`canvas.toBlob(b => navigator.share({files:[...]}))`，不支援 share 則 `<a download>` PNG。
- 道號設定：首訪或結算卡上的「取道號」按鈕 → 寫 `ctx.meta.profile.name`（2–6 字，本機驗證）＋ saveMeta。

### 挑戰碼（結算卡上的「發起挑戰」按鈕 + 主畫面「輸入挑戰碼」入口 `#challenge-input`）

```js
import { makeChallengeCode, parseChallengeCode, compareChallenge, recordChallenge } from './meta/summary.js';
import { earnPearls } from './meta/economy.js';

// 發起：本局 10 題 id + 成績打包
const code = makeChallengeCode({ v: 1, name: meta.profile.name, questionIds, correct, timeMs, pearls, date: today });
// → 顯示 + 複製到剪貼簿

// 應戰：貼碼 → parseChallengeCode(code)（null = 無效碼，toast）→ 用 payload.questionIds 出完全相同 10 題
// 打完 → compareChallenge(mine, payload)
//   result==='win' → 「奪珠成功！」＋ earnPearls(meta, bonusPearls, 'challenge', today)
// recordChallenge(meta, {...}) 記錄（上限 30 筆自動裁）＋ saveMeta
```

---

## 5. 事件渲染表（`renderEvents` 的 switch）

所有事件 `{type, payload, fx}`；`fx` 是給美術組的動畫規格代號。**同一批事件依序播即可**（kernel 已排好順序）。

| type | payload 重點 | UI | fx |
|---|---|---|---|
| `xpGained` | `amount` | 文氣數字飄upward | `xp-rise` |
| `levelUp` | `{rank, name, blessing}` | 全螢幕「開悟」動畫＋境界名＋祝賀語、小書生換裝提示 | `rank-glow` |
| `pearlEarned` | `{amount, reason, capped}` | 珠子噴出動畫飛向 `#pearl-balance`；`capped` 真時 toast「今日字珠已滿 120」 | `pearl-pop` |
| `purified` | `{id, zone}` | 進度環 `#world-ring` +1 微動畫 | `pearl-clean` |
| `worldLetter` | `Letter {title, text}` | 「墨界回信」彈卡（已自動標記為已讀，關掉即可） | `letter-unfold` |
| `pearlForged` | `{id, grade, gradeName}` | 「煉成 {gradeName}！」彈卡＋圖鑑格點亮 | `pearl-glow-gold/cyan/white` |
| `pearlDusted` | `{id, setBox, message}` | 小 toast（不打斷）：「字珠蒙塵了…」 | `pearl-dust` |
| `pearlPolished` | `{id, gradeName, setBox}` | 「擦亮了！」toast＋圖鑑格復原 | `pearl-polish` |
| `gradeUp` | `{id, grade, gradeName}` | 品階升級演出（墨玉時全螢幕） | `pearl-grade-up` / `pearl-glow-obsidian` |
| `encounter` | 事件物件（`id/name/desc/effect`） | 奇遇彈卡（名稱＋描述）；effect 已由 kernel 落地，UI 只演出。`challenge` 型見 §3 | `encounter-swirl` |
| `lanternLit` | `{streak, tier, message}` | 長明燈點亮動畫＋「今日文脈由你守住了」 | `lantern-lit` |
| `lanternTierUp` | `{tier, name}` | 燈升階演出（換燈皮膚） | `lantern-tier-up` |
| `lanternOut` | `{message}` | 開站時柔性提示（非懲罰語氣） | `lantern-dim` |
| `lanternMilestone` | `{days, pearls, title}` | 里程碑彈卡（稱號＋珠） | `milestone-stamp` |
| `charmUsed` | `{days, remaining, message}` | 「護珠符替你守住了墨燈」彈卡 | `charm-glow` |
| `charmGranted` | `{charms}` | 獲得護珠符 toast | `charm-new` |
| `boxUnlocked` | `{date}` | `#daily-box` 墨匣圖示出現/搖晃 | `box-appear` |
| `achievement` | `{id, name, desc, title, pearls}` | 成就印章「蓋章」動畫；`title` 非 null 時加稱號演出 | `ink-stamp` |
| `charmTriggered` | `{charm:'combo'/'scroll', name, message}` | 戰中：墨符燃起金光／殘卷微光 | `charm-gold` / `scroll-light` |
| `comboShielded` | `{source:'shouxin'/'songyan', name}` | 「連對被 {name} 保住了」小字 | `shield-ink` |
| `artReady` | `{artId}` | 墨氣條滿格發光、發動鈕開始呼吸 | `ink-gauge-full` |
| `doubleDamage` | `{dmg}` | 潑墨大字傷害演出 | `ink-splash` |
| `burst` | `{dmg, gear}` | 歙硯爆發 30 傷演出 | `ink-burst` |
| `reflect` | `{dmg, gear}` | 油煙墨反彈小演出 | `ink-drip` |
| `bondLine` | `{line, stage}` | `#moling-bubble` 顯示台詞（2–3 秒淡出） | `speech-bubble` |
| `bondStageUp` | `{stage, stageName}` | 羈絆升階演出（墨靈立繪變化提示） | `bond-bloom` |
| `gift` | `GIFTS 項（type: pearls/story/title/lines/goldFrame）` | 贈禮彈卡；`story` 型顯示身世小故事文（美術組文案）；珠已自動入帳 | `gift-open` |
| `artUnlocked` | `{id, name, desc}` | 新訣解鎖卷軸演出 | `scroll-open` |

---

## 6. 每日墨匣（主畫面 `#daily-box`）

```js
import { getBoxState, openBox } from './meta/daily.js';

const box = getBoxState(ctx.meta, today);
// box.unlocked=false → 顯示「今日已煉 {lantern.todayCorrect}/10 字」灰匣
// box.unlocked && !box.opened → 可點；box.liuliAvailable → 換琉璃匣皮膚
// 點開：
const r = openBox(ctx.meta, today);          // {ok:false} 或 {reward:{pearls, liuli, weekTitle, glow}}
// reward.glow==='青光' → 至少一次青光演出；liuli 真 → 琉璃匣大演出＋週稱號
saveMeta(ctx.meta);
```

## 7. 獨立頁面（各模組純資料 getter，UI 自建）

| 頁 | 資料 API | 備註 |
|---|---|---|
| 圖鑑頁 `#collection-page` | `collection.getCollection(meta)`＋兩個題庫的完整 id 清單 | 兩卷：字音字形 250 格＋成語 435 格；未煉成＝墨影剪影＋「？」（`.pearl-cell--silhouette`）；品階發光 `.pearl-cell--grade-{0..3}`；蒙塵 `.pearl-cell--dusty` |
| 擂台頁 `#arena-page` | `arena.getDailyQuestionIds(allIds, today)`（全班同 10 題）→ 打完 `arena.submitEntry(meta, {name, avatar, correct, timeMs, bestCombo}, today)` → `arena.getBoard(meta)` 前 10、`arena.getHistory(meta)` 歷代珠王、`arena.buildBroadcast(meta)` 投影戰報（`heraldLines` 逐行大字） | 道號 2–4 字＋12 頭像（`arena.AVATARS`）；榜首結算卡 `summary.seal='zhuwang'` 蓋金印 |
| 裝備商店頁 | §3 戰前 | |

## 8. CSS class 命名建議（給視覺組）

`--` modifier 風格：`.event-toast`, `.event-modal`, `.pearl-cell`, `.pearl-cell--dusty`, `.gear-card--owned`, `.gear-card--equipped`, `.option--eliminated`, `.combo--hot`, `.lantern--tier-0..3`, `.lantern--out`, `.summary-card--gold-frame`, `.ink-gauge__fill`, `.arena-board__row--top1`。動畫 keyframes 直接用 fx 代號命名（如 `@keyframes ink-stamp`）。

## 9. 鐵律與注意事項

1. **只有 kernel（與上表明列的模組函式）會寫 `zzj_meta`**；app.js 不可自己動 localStorage。
2. **答題後不可再呼叫 `leitner.recordAnswer` / `battle.applyAnswer`**——kernel/adapter 已代呼叫，重複呼叫＝重複計分。
3. `today` 一律 `new Date().toLocaleDateString('sv')`（本地時區 YYYY-MM-DD），全站同一來源。
4. 珠的入帳全部在 kernel/模組內完成，UI 只演出；唯二例外：挑戰碼 `bonusPearls`（§4）與字妖突襲回血（§3）由 UI 觸發。
5. 每日獲珠上限 120（`capped` 事件旗標）；成就/守燈里程碑/羈絆贈禮不受限。
6. `ctx` 一個分頁一顆、跨練習/對戰共用；重新整理頁面 → 重跑 `initSession`（Leitner/珠/進度都會從 `zzj_meta` 還原）。
7. 隱私模式 localStorage 不可用時，store 自動退回記憶體（當次可玩、關頁即失），不會拋錯。
