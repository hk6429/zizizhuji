import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sceneHtml, styleOptionsHtml, plaqueComposerHtml } from '../js/shuyuan-ui.js';
import { defaultMeta } from '../js/meta/store.js';
import {
  defaultShuyuan, getShuyuanView, placeDecoration,
  DECOR_KINDS, PLAQUE_BANK, COUPLET_BANK,
} from '../js/meta/shuyuan-store.js';

function viewOf(mutate = () => {}) {
  const m = defaultMeta();
  const s = defaultShuyuan();
  mutate(m, s);
  return getShuyuanView(m, s, { yin: 100, xing: 100, chengyu: 100 });
}

test('sceneHtml 含山門（帶境界階段圖）＋三院落（帶繁茂度圖）＋匾額預設字', () => {
  const html = sceneHtml(viewOf((m) => { m.xp.rank = 4; }));
  assert.ok(html.includes('gate-s5.jpg'));            // rank 4 → 第 5 階山門圖
  assert.ok(html.includes('court-yin-t1.jpg'));       // 0% → 荒蕪 tier1 圖
  assert.ok(html.includes('字靈書院'));                 // 預設匾額
  assert.ok(html.includes('data-target="gate"'));     // 匾額點擊掛鉤
  assert.ok(html.includes('onerror'));                // 缺圖佔位防線
});

test('sceneHtml 依裝飾座標輸出可拖曳元素', () => {
  const html = sceneHtml(viewOf((m, s) => {
    m.collection['x1'] = { grade: 3, wrong: 0, earnedAt: '2026-01-01', dusty: false, polish: 0, streak: 0 };
    placeDecoration(s, 'statue-0', 25, 75);
  }));
  assert.ok(html.includes('data-decor="statue-0"'));
  assert.ok(html.includes('left:25%'));
  assert.ok(html.includes('top:75%'));
  assert.ok(html.includes('decor-statue-0.png'));     // styleIdx 0
});

test('sceneHtml 有掛對聯時輸出上下聯', () => {
  const html = sceneHtml(viewOf((m, s) => { s.couplet = 'c3'; }));
  assert.ok(html.includes('筆下有神驅濁墨'));
  assert.ok(html.includes('胸中藏典煉真珠'));
});

test('styleOptionsHtml 列出該類全部樣式並標記目前選中', () => {
  const html = styleOptionsHtml('lantern', 1);
  for (const name of DECOR_KINDS.lantern.styles) assert.ok(html.includes(name));
  assert.ok(html.includes('data-style="1"'));
  assert.ok(html.includes('is-active'));
  assert.equal((html.match(/is-active/g) || []).length, 1); // 只標一個
});

test('plaqueComposerHtml 有 24 顆選字鈕；gate 才有對聯區', () => {
  const html = plaqueComposerHtml('gate', '字靈書院');
  assert.equal((html.match(/data-char=/g) || []).length, PLAQUE_BANK.length);
  assert.ok(html.includes(COUPLET_BANK[0].up));
  const courtHtml = plaqueComposerHtml('yin', '谷音亭');
  assert.ok(!courtHtml.includes(COUPLET_BANK[0].up)); // 院落不掛對聯
});
