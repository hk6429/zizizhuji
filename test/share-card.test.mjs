import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldOfferShareCard } from '../js/meta/share-card.js';

test('shouldOfferShareCard：羈絆滿百（goldFrame）一律提供分享卡', () => {
  assert.equal(shouldOfferShareCard({ goldFrame: true }), true);
  assert.equal(shouldOfferShareCard({ goldFrame: true }, { newRecord: false }), true);
});

test('shouldOfferShareCard：破紀錄時提供分享卡', () => {
  assert.equal(shouldOfferShareCard({ goldFrame: false }, { newRecord: true }), true);
});

test('shouldOfferShareCard：一般結算卡不提供', () => {
  assert.equal(shouldOfferShareCard({ goldFrame: false }), false);
  assert.equal(shouldOfferShareCard({ goldFrame: false }, { newRecord: false }), false);
});

test('shouldOfferShareCard：無 summary 時回傳 false', () => {
  assert.equal(shouldOfferShareCard(null), false);
});
