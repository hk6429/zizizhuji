import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('overlay ghost buttons provide a 44px touch target with centered inline-flex content', async () => {
  const css = await readFile(new URL('../css/style.css', import.meta.url), 'utf8');
  const rule = css.match(/\.overlay-ghost-btn\s*\{([^}]+)\}/)?.[1] || '';
  assert.match(rule, /min-height\s*:\s*44px\s*;/);
  assert.match(rule, /display\s*:\s*inline-flex\s*;/);
  assert.match(rule, /align-items\s*:\s*center\s*;/);
  assert.match(rule, /justify-content\s*:\s*center\s*;/);
});

test('首頁把進階玩法收合，並將自學墨池提升到收合區之前', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<details[^>]+id="advanced-play"/);
  const selfStudyAt = html.indexOf('id="btn-selfstudy"');
  const advancedAt = html.indexOf('id="advanced-play"');
  assert.ok(selfStudyAt >= 0 && selfStudyAt < advancedAt, '自學・墨池應位於進階玩法收合區之前');
  for (const id of ['btn-pet', 'btn-fusion', 'btn-rtbattle', 'btn-market', 'btn-scoregame', 'btn-tianxia']) {
    const at = html.indexOf(`id="${id}"`);
    assert.ok(at > advancedAt, `${id} 應收進進階玩法`);
  }
});
