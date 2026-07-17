import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, MOLING_STORY, GIFTS } from '../js/meta/bond.js';

test('每個階段每種情境至少有 3 句台詞可輪替', () => {
  const situations = ['open', 'correct', 'combo3', 'wrong', 'win', 'lose'];
  for (let stage = 0; stage < LINES.length; stage++) {
    for (const situation of situations) {
      const pool = LINES[stage][situation];
      assert.ok(Array.isArray(pool), `stage ${stage} 缺少 ${situation}`);
      assert.ok(pool.length >= 3, `stage ${stage} 的 ${situation} 只有 ${pool.length} 句`);
    }
  }
});

test('墨靈身世小故事有實際內容，不是空殼佔位', () => {
  const story = GIFTS.find(g => g.type === 'story');
  assert.ok(story, 'GIFTS 應有一個 type=story 的贈禮');
  assert.ok(Array.isArray(MOLING_STORY) && MOLING_STORY.length >= 3);
  for (const card of MOLING_STORY) {
    assert.ok(card.text && card.text.length >= 10, `${card.id} 內容過短`);
  }
});
