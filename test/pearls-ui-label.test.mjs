import { test } from 'node:test';
import assert from 'node:assert/strict';
import { labelOf } from '../js/pearls-ui.js';

test('labelOf keeps legacy reading extraction and falls back to a new-format anchor', () => {
  assert.equal(labelOf({ type: '字音', question: '「佞臣」的「佞」正確讀音是？', answer: 'ㄋㄧㄥˋ' }), '佞');
  assert.equal(labelOf({ type: '字音', question: '生活情境中，這個字怎麼念？', anchor: ['擰'], answer: 'ㄋㄧㄥˇ' }), '擰');
  assert.equal(labelOf({ type: '成語', question: '哪一句正確？', anchor: ['一意孤行'], answer: '選項句子' }), '一意孤行');
});
