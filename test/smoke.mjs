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
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

await page.goto('http://localhost:4173');
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

if (practiceOptionCount !== 4) throw new Error(`練習模式選項數應為4，實際 ${practiceOptionCount}`);
if (battleOptionCount !== 4) throw new Error(`對戰模式選項數應為4，實際 ${battleOptionCount}`);
if (!hudVisible) throw new Error('對戰模式狀態列 #battle-hud 應顯示');
if (errors.length) throw new Error(`頁面出現 JS 錯誤: ${errors.join(' | ')}`);

console.log('smoke test PASS');
