// test/smoke.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png' };
const ROOT = new URL('..', import.meta.url).pathname;

const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url;
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'text/plain' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});

await new Promise(resolve => server.listen(4173, resolve));

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', err => errors.push(err.message));
// 資源 404（尚未生成的美術圖）不算程式錯誤；真正的 JS 例外由 pageerror 捕捉
page.on('console', msg => {
  if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) errors.push(msg.text());
});

await page.goto('http://localhost:4173');
// 首訪會先跳「開卷誓言」攔截層，先跳過才點得到模式按鈕
await page.waitForSelector('#oath-overlay:not([hidden])');
await page.click('#oath-skip');
// 首訪誓言收掉後會補跳「修行小抄」術語卡，關掉才能繼續
await page.waitForSelector('#terms-overlay:not([hidden])');
await page.click('#terms-close');

// 學制切換：預設國小，切到國中後應重整頁面並套用國中題庫
await page.waitForSelector('#level-select');
const levelDefaultActive = await page.$eval('#level-elem', el => el.classList.contains('is-active'));
await page.click('#level-junior');
await page.waitForSelector('#level-junior.is-active');
await page.click('#btn-practice');
await page.waitForSelector('#options button');
const juniorPracticeOptionCount = await page.$$eval('#options button', els => els.length);
await page.click('#btn-back');
// 切回國小，後續其餘檢查沿用國小題庫
await page.click('#level-elem');
await page.waitForSelector('#level-elem.is-active');

// 「更多功能」預設收合（漸進揭露），要先展開才點得到寵物閣／自學／文氣爭鋒
await page.click('.more-section > summary');
await page.waitForSelector('#btn-pet', { state: 'visible' });

// 寵物閣：開啟後應渲染 12 隻神獸格；已解鎖的（unlockAt 0）要有羈絆階段文字與小傳按鈕
await page.click('#btn-pet');
await page.waitForSelector('#pet-overlay:not([hidden])');
const petCount = await page.$$eval('#pet-grid .pet-card-item', els => els.length);
const bondTextShown = await page.$('#pet-grid .pet-card-item__bond') !== null;
const bioBtnShown = await page.$('#pet-grid .pet-card-item__bio-btn') !== null;
await page.click('#pet-close');

// 融合坊：開啟後應顯示墨晶餘額與三張類別卡（字音／成語／混合）
await page.click('#btn-fusion');
await page.waitForSelector('#fusion-overlay:not([hidden])');
const fusionCrystalText = await page.$eval('#fusion-crystal-balance', el => el.textContent.trim());
const fusionCatCount = await page.$$eval('#fusion-panel-forge .fusion-cat-card', els => els.length);
await page.click('#fusion-close');

// 字珠寶殿：開啟後顯示品階統計列（新玩家 0 顆 → 空狀態文案）
await page.click('#btn-pearls');
await page.waitForSelector('#pearls-overlay:not([hidden])');
const pearlsCountChips = await page.$$eval('#pearls-counts .pearls-count', els => els.length);
const pearlsEmptyShown = await page.$eval('#pearls-empty', el => !el.hidden);
const pearlsStatRows = await page.$$eval('#pearls-stats .pearls-stat-row', els => els.length);
if (pearlsStatRows !== 2) throw new Error(`expected 2 pearls-stat-row (字音字形/成語), got ${pearlsStatRows}`);
const pearlsStatText = await page.$eval('#pearls-stats', el => el.textContent);
if (!pearlsStatText.includes('已認識') || !pearlsStatText.includes('還剩')) {
  throw new Error(`pearls-stats missing progress numbers: ${pearlsStatText}`);
}
await page.click('#pearls-close');

// 翰墨集市：開啟後顯示透明規則區（固定可見），內含「不可兌換現實金錢」條款
await page.click('#btn-market');
await page.waitForSelector('#market-overlay:not([hidden])');
const mktRulesText = await page.$eval('#mkt-rules', el => el.textContent);
const mktNoCryptoRule = mktRulesText.includes('不可兌換現實金錢');
const mktSellSectionExists = await page.$('#mkt-sell') !== null;
await page.click('#market-close');

// 上架流程：本機塞一件裝備（狼毫筆）後 reload，集市上架區應出現該裝備珠面鈕，
// 點選後價格輸入預設值＝該階下界（凡品 40），band 提示含「40–120」區間
// 上架區只在開市時渲染，測試日不一定是週五16:00~週日，改用 localStorage 旗標
// 讓 Date.now() 假裝落在週六中午（僅 addInitScript 掛在這個 page 物件，不影響 parentPage）
await page.addInitScript(() => {
  if (localStorage.getItem('zz_mkt_test_force_open') === '1') {
    Date.now = () => Date.UTC(2026, 6, 25, 4, 0); // 2026-07-25 週六 12:00 (UTC+8)
  }
});
await page.evaluate(() => {
  const raw = localStorage.getItem('zzj_meta');
  const m = raw ? JSON.parse(raw) : {};
  m.gear = m.gear || { owned: [], loadout: [] };
  m.gear.owned = ['langhao'];
  localStorage.setItem('zzj_meta', JSON.stringify(m));
  localStorage.setItem('zz_mkt_test_force_open', '1');
});
await page.reload();
await page.click('.more-section > summary');
await page.waitForSelector('#btn-pet', { state: 'visible' });
await page.click('#btn-market');
await page.waitForSelector('#market-overlay:not([hidden])');
await page.waitForSelector('#mkt-sell-gear-list button');
const sellGearBtnText = await page.$eval('#mkt-sell-gear-list button', el => el.textContent);
await page.click('#mkt-sell-gear-list button');
await page.waitForSelector('#mkt-sell-price');
const sellPriceDefault = await page.$eval('#mkt-sell-price', el => el.value);
const sellBandText = await page.$eval('#mkt-sell-band', el => el.textContent);
await page.click('#market-close');

// 成就總覽：開啟後應渲染 18 個成就卡
await page.click('#btn-achievements');
await page.waitForSelector('#ach-overlay:not([hidden])');
const achCount = await page.$$eval('#ach-grid .ach-item', els => els.length);
await page.click('#ach-close');

// 雲端存檔：開啟後應自動產生並顯示 6 碼代碼；複製代碼按鈕與家長每日上限設定要存在
await page.click('#btn-savesync');
await page.waitForSelector('#savesync-overlay:not([hidden])');
const savesyncCode = await page.$eval('#savesync-code', el => el.textContent.trim());
const savesyncCopyBtnExists = await page.$('#savesync-copy') !== null;
const dailyLimitInputExists = await page.$('#savesync-daily-limit') !== null;
await page.click('#savesync-close');

// 自學・墨池：三款遊戲選單；進「記憶配對牌」應鋪出 16 張牌
await page.click('#btn-selfstudy');
await page.waitForSelector('#selfstudy-overlay:not([hidden])');
const ssMenuCount = await page.$$eval('#ss-menu .ss-menu-card', els => els.length);
await page.click('#ss-menu .ss-menu-card:nth-child(1)'); // 記憶配對牌
await page.waitForSelector('#ss-board .mem-card');
const memCardCount = await page.$$eval('#ss-board .mem-card', els => els.length);
await page.click('#ss-back');
await page.click('#ss-menu .ss-menu-card:nth-child(2)'); // 閃卡
await page.waitForSelector('#ss-board .flash-card');
await page.click('#ss-board .flash-card'); // 翻卡看答案
await page.waitForSelector('.flash-rate__btn--yes');
await page.click('#ss-back');
await page.click('#ss-menu .ss-menu-card:nth-child(3)'); // 連連看
await page.waitForSelector('#ss-board .link-tile:not(.is-empty)');
const linkTileCount = await page.$$eval('#ss-board .link-tile:not(.is-empty)', els => els.length);
await page.click('#ss-back');
await page.click('#ss-close');

// 文氣爭鋒：三種模式；進「獨自衝分」應出 4 選項
await page.click('#btn-scoregame');
await page.waitForSelector('#scoregame-overlay:not([hidden])');
const sgMenuCount = await page.$$eval('#sg-menu .sg-menu-card', els => els.length);
const hideRankingToggleExists = await page.$('.sg-classbar__hide input[type="checkbox"]') !== null;
await page.click('#sg-menu .sg-menu-card'); // 第一張＝獨自衝分
await page.waitForSelector('#sg-options .sg-opt');
const sgOptionCount = await page.$$eval('#sg-options .sg-opt', els => els.length);
await page.click('#sg-close');

await page.click('#btn-practice');
await page.waitForSelector('#options button');
const practiceOptionCount = await page.$$eval('#options button', els => els.length);

// 數字鍵 1-4 快捷作答：按下 2 應等同點擊第二個選項
await page.keyboard.press('2');
await page.waitForSelector('#options button.correct, #options button.wrong');
const kbSecondOptionAnswered = await page.$eval(
  '#options button:nth-child(2)',
  (el) => el.classList.contains('correct') || el.classList.contains('wrong'),
);
const kbButtonsDisabled = await page.$$eval('#options button', (els) => els.every((b) => b.disabled));
const answerFeedbackShown = await page.$eval('#answer-feedback', (el) => !el.hidden && el.textContent.trim().length > 0);
// 練習模式改手動前進：答完題不會自動跳下一題，要等使用者看完解說按「下一題」
const nextBtnShownBeforeClick = await page.$eval('#answer-next-btn', (el) => !el.hidden);
await page.waitForTimeout(900); // 確認過了原本 FEEDBACK_DELAY(800ms) 仍停在同一題，不會自動前進
const stillSameOptionsAfterDelay = await page.$eval('#options button:first-child', (el) => el.disabled);
// 空白鍵＝手動前進的快捷鍵，等同點擊「下一題」
await page.keyboard.press(' ');
await page.waitForSelector('#options button:not([disabled])');

// 新版畫卷式版面：答題中首頁收起，需先「收卷回首頁」才能切到對戰
// 剛才用數字鍵答過題，收卷會跳戰報卷軸，需先關掉才能點下一個功能
await page.click('#btn-back');
await page.waitForSelector('#summary-scroll:not([hidden])');
await page.click('#summary-close');
await page.waitForSelector('#btn-battle', { state: 'visible' });
await page.click('#btn-battle');
await page.waitForSelector('#options button');
const battleOptionCount = await page.$$eval('#options button', els => els.length);
const hudVisible = await page.$eval('#battle-hud', el => !el.hidden);

// 分享圖卡按鈕存在於 DOM（預設 hidden，只在破紀錄/羈絆滿百時顯示，這裡不跑完整場只驗證元件存在）
const shareCardBtnExists = await page.$('#summary-share-card') !== null;

// 家長儀表板：獨立頁面，無效代碼查詢應顯示錯誤訊息、不拋 JS 例外
const parentErrors = [];
const parentPage = await browser.newPage();
parentPage.on('pageerror', err => parentErrors.push(err.message));
parentPage.on('console', msg => {
  if (msg.type() === 'error' && !/Failed to load resource/.test(msg.text())) parentErrors.push(msg.text());
});
await parentPage.goto('http://localhost:4173/parent.html');
const parentLookupInputExists = await parentPage.$('#pd-code') !== null;
await parentPage.fill('#pd-code', 'ZZZZZZ');
await parentPage.click('#pd-go');
await parentPage.waitForSelector('#pd-status.pd-status--err');
const parentReportHidden = await parentPage.$eval('#pd-report', el => el.hidden);

await browser.close();
server.close();

if (!levelDefaultActive) throw new Error('預設應為國小學制（#level-elem.is-active）');
if (juniorPracticeOptionCount !== 4) throw new Error(`國中練習模式選項數應為4，實際 ${juniorPracticeOptionCount}`);
if (petCount !== 12) throw new Error(`寵物閣應有 12 隻神獸，實際 ${petCount}`);
if (!bondTextShown) throw new Error('已解鎖寵物卡片應顯示羈絆階段文字 .pet-card-item__bond');
if (!bioBtnShown) throw new Error('已解鎖寵物卡片應有「查看小傳」按鈕 .pet-card-item__bio-btn');
if (!/^\d+$/.test(fusionCrystalText)) throw new Error(`融合坊墨晶餘額應為數字，實際 "${fusionCrystalText}"`);
if (fusionCatCount !== 3) throw new Error(`融合坊應渲染 3 張類別卡（字音/成語/混合），實際 ${fusionCatCount}`);
if (achCount !== 18) throw new Error(`成就總覽應有 18 個成就，實際 ${achCount}`);
if (pearlsCountChips !== 4) throw new Error(`字珠寶殿應有 4 個品階統計，實際 ${pearlsCountChips}`);
if (!pearlsEmptyShown) throw new Error('新玩家的字珠寶殿應顯示空狀態文案');
if (!mktNoCryptoRule) throw new Error('翰墨集市規則區應明載「字珠不可兌換現實金錢或禮物」');
if (!mktSellSectionExists) throw new Error('翰墨集市應有 #mkt-sell 上架區塊');
if (!sellGearBtnText.includes('狼毫筆')) throw new Error(`上架區珠面鈕應顯示裝備名「狼毫筆」，實際 "${sellGearBtnText}"`);
if (sellPriceDefault !== '40') throw new Error(`點選裝備後價格輸入預設值應為 40（凡品下界），實際 "${sellPriceDefault}"`);
if (!sellBandText.includes('40–120')) throw new Error(`定價帶提示應含「40–120」，實際 "${sellBandText}"`);
if (!/^[A-Z0-9]{6}$/.test(savesyncCode)) throw new Error(`雲端存檔代碼格式應為 6 碼英數，實際「${savesyncCode}」`);
if (ssMenuCount !== 4) throw new Error(`自學選單應有 4 款遊戲，實際 ${ssMenuCount}`);
if (memCardCount !== 16) throw new Error(`記憶配對牌應鋪 16 張，實際 ${memCardCount}`);
if (linkTileCount !== 16) throw new Error(`連連看應鋪 16 張，實際 ${linkTileCount}`);
if (sgMenuCount !== 3) throw new Error(`文氣爭鋒應有 3 種模式，實際 ${sgMenuCount}`);
if (sgOptionCount !== 4) throw new Error(`文氣爭鋒選項數應為 4，實際 ${sgOptionCount}`);
if (practiceOptionCount !== 4) throw new Error(`練習模式選項數應為4，實際 ${practiceOptionCount}`);
if (!kbSecondOptionAnswered) throw new Error('按數字鍵 2 應觸發第二個選項作答（correct/wrong class）');
if (!kbButtonsDisabled) throw new Error('數字鍵作答後所有選項應被 disabled');
if (!answerFeedbackShown) throw new Error('作答後 #answer-feedback 應顯示答對/答錯回饋文字');
if (!nextBtnShownBeforeClick) throw new Error('練習模式答題後應顯示手動前進的 #answer-next-btn');
if (!stillSameOptionsAfterDelay) throw new Error('練習模式答題後不應自動前進，需等使用者手動點「下一題」');
if (!shareCardBtnExists) throw new Error('分享圖卡按鈕 #summary-share-card 應存在於 DOM');
if (battleOptionCount !== 4) throw new Error(`對戰模式選項數應為4，實際 ${battleOptionCount}`);
if (!hudVisible) throw new Error('對戰模式狀態列 #battle-hud 應顯示');
if (!savesyncCopyBtnExists) throw new Error('雲端存檔應有「複製代碼」按鈕 #savesync-copy');
if (!dailyLimitInputExists) throw new Error('雲端存檔應有家長每日上限輸入框 #savesync-daily-limit');
if (!hideRankingToggleExists) throw new Error('班級榜列應有「只看自己進步」checkbox');
if (errors.length) throw new Error(`頁面出現 JS 錯誤: ${errors.join(' | ')}`);
if (!parentLookupInputExists) throw new Error('家長儀表板應有存檔代碼輸入框 #pd-code');
if (!parentReportHidden) throw new Error('查無代碼時 #pd-report 應維持 hidden');
if (parentErrors.length) throw new Error(`家長儀表板頁面出現 JS 錯誤: ${parentErrors.join(' | ')}`);

console.log('smoke test PASS');
