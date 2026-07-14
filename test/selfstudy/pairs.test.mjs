import { test } from 'node:test';
import assert from 'node:assert';
import { extractTargetChar, isZhuyin, buildPairs } from '../../js/selfstudy/pairs.js';

test('extractTargetChar 取最後一組單字引號', () => {
  assert.equal(extractTargetChar('「魚拓」的「拓」正確讀音是？'), '拓');
  assert.equal(extractTargetChar('「鐫刻」的「鐫」正確讀音是？'), '鐫');
});

test('extractTargetChar：多字引號或無引號回 null', () => {
  assert.equal(extractTargetChar('下列何者正確？'), null);
  assert.equal(extractTargetChar('「魚拓」的讀音是？'), null); // 只有雙字組
});

test('isZhuyin 認得注音、拒絕成語與國字', () => {
  assert.equal(isZhuyin('ㄊㄚˋ'), true);
  assert.equal(isZhuyin('ㄐㄩㄢ'), true);
  assert.equal(isZhuyin('未雨綢繆'), false);
  assert.equal(isZhuyin('拓'), false);
});

test('buildPairs 只收注音答案、字去重', () => {
  const bank = [
    { id: 'a', question: '「魚拓」的「拓」讀音？', answer: 'ㄊㄚˋ' },
    { id: 'b', question: '「魚拓」的「拓」讀音？', answer: 'ㄊㄚˋ' }, // 重複字，去重
    { id: 'c', question: '「鐫刻」的「鐫」讀音？', answer: 'ㄐㄩㄢ' },
    { id: 'd', question: '下列何者為錯字？', answer: '未雨綢繆' },       // 非注音，排除
  ];
  const pairs = buildPairs(bank);
  assert.equal(pairs.length, 2);
  assert.deepEqual(pairs.map((p) => p.char), ['拓', '鐫']);
  assert.equal(pairs[0].zhuyin, 'ㄊㄚˋ');
});

test('buildPairs limit 生效', () => {
  const bank = [
    { id: 'a', question: '「甲乙」的「甲」讀音？', answer: 'ㄐㄧㄚˇ' },
    { id: 'b', question: '「丙丁」的「丙」讀音？', answer: 'ㄅㄧㄥˇ' },
    { id: 'c', question: '「戊己」的「戊」讀音？', answer: 'ㄨˋ' },
  ];
  assert.equal(buildPairs(bank, 2).length, 2);
});
