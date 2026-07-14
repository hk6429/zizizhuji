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

// 寵物閣：開啟後應渲染 12 隻神獸格
await page.click('#btn-pet');
await page.waitForSelector('#pet-overlay:not([hidden])');
const petCount = await page.$$eval('#pet-grid .pet-card-item', els => els.length);
await page.click('#pet-close');

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

// 積分競技：三種模式；進「獨自衝分」應出 4 選項
await page.click('#btn-scoregame');
await page.waitForSelector('#scoregame-overlay:not([hidden])');
const sgMenuCount = await page.$$eval('#sg-menu .sg-menu-card', els => els.length);
await page.click('#sg-menu .sg-menu-card'); // 第一張＝獨自衝分
await page.waitForSelector('#sg-options .sg-opt');
const sgOptionCount = await page.$$eval('#sg-options .sg-opt', els => els.length);
await page.click('#sg-close');

await page.click('#btn-practice');
await page.waitForSelector('#options button');
const practiceOptionCount = await page.$$eval('#options button', els => els.length);

// 新版畫卷式版面：答題中首頁收起，需先「收卷回首頁」才能切到對戰
await page.click('#btn-back');
await page.waitForSelector('#btn-battle', { state: 'visible' });
await page.click('#btn-battle');
await page.waitForSelector('#options button');
const battleOptionCount = await page.$$eval('#options button', els => els.length);
const hudVisible = await page.$eval('#battle-hud', el => !el.hidden);

await browser.close();
server.close();

if (petCount !== 12) throw new Error(`寵物閣應有 12 隻神獸，實際 ${petCount}`);
if (ssMenuCount !== 3) throw new Error(`自學選單應有 3 款遊戲，實際 ${ssMenuCount}`);
if (memCardCount !== 16) throw new Error(`記憶配對牌應鋪 16 張，實際 ${memCardCount}`);
if (linkTileCount !== 16) throw new Error(`連連看應鋪 16 張，實際 ${linkTileCount}`);
if (sgMenuCount !== 3) throw new Error(`積分競技應有 3 種模式，實際 ${sgMenuCount}`);
if (sgOptionCount !== 4) throw new Error(`積分競技選項數應為 4，實際 ${sgOptionCount}`);
if (practiceOptionCount !== 4) throw new Error(`練習模式選項數應為4，實際 ${practiceOptionCount}`);
if (battleOptionCount !== 4) throw new Error(`對戰模式選項數應為4，實際 ${battleOptionCount}`);
if (!hudVisible) throw new Error('對戰模式狀態列 #battle-hud 應顯示');
if (errors.length) throw new Error(`頁面出現 JS 錯誤: ${errors.join(' | ')}`);

console.log('smoke test PASS');
