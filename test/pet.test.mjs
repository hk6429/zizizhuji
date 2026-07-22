import { test } from 'node:test';
import assert from 'node:assert/strict';
import { petLevel, PET_EQUIP, MAX_LEVEL, PETS,
  petPracticeBonus, petPracticeHint, usePetSkill, petSkillRemaining,
  activePetName, MAX_PET_SKILL_USES, setActivePet } from '../js/meta/pet.js';
import { defaultMeta } from '../js/meta/store.js';

// 建 meta：出戰某寵，並用 n 題已煉成的字珠灌該類別精通（prefix 決定類別）。
function metaWith(petId, prefix = 'zy', mastered = 0) {
  const m = defaultMeta();
  for (let i = 0; i < mastered; i++) m.collection[`${prefix}-${i}`] = { earnedAt: 1 };
  setActivePet(m, petId);
  return m;
}

const TIERS = new Set(['白', '青', '金', '墨玉']);

test('petLevel：精通題數再高也不超過 MAX_LEVEL', () => {
  const meta = { collection: {} };
  for (let i = 0; i < 999; i++) {
    meta.collection[`zy-${i}`] = { earnedAt: 1 };
  }
  const baize = PETS.find((p) => p.id === 'baize');
  assert.equal(petLevel(meta, baize), MAX_LEVEL);
});

test('petLevel：精通題數為 0 時等級為 0', () => {
  const meta = { collection: {} };
  const baize = PETS.find((p) => p.id === 'baize');
  assert.equal(petLevel(meta, baize), 0);
});

test('PET_EQUIP：每件裝備皆有合法的 tier 標籤', () => {
  for (const e of PET_EQUIP) {
    assert.ok(TIERS.has(e.tier), `${e.id} 的 tier「${e.tier}」不在合法列表中`);
  }
});

test('高段設備擴充：四件新設備 schema 合法且花費遞增', () => {
  const ids = ['panhu', 'bifang', 'taowu', 'zhuyin'];
  const byId = new Map(PET_EQUIP.map((e) => [e.id, e]));
  let prevPrice = 0;
  for (const id of ids) {
    const e = byId.get(id);
    assert.ok(e, `缺少新設備 ${id}`);
    assert.ok(e.price > prevPrice, `${id} 價格應高於前一件`);
    prevPrice = e.price;
    assert.equal(e.upgradeCost.length, 2);
    assert.equal(e.upgradeGate.length, 2);
    const hasEffect = (e.effect.damageBonus || 0) > 0 || (e.effect.freeEliminate || 0) > 0;
    assert.ok(hasEffect, `${id} 應至少有一種戰鬥效果`);
  }
});

/* ===== 練習被動加珠 petPracticeBonus ===== */
test('無出戰寵物時練習加珠為 0', () => {
  const m = defaultMeta();
  assert.equal(petPracticeBonus(m, 'zy-1'), 0);
});

test('專精寵物只對同類題加珠、不符給 0；等級高則加更多', () => {
  const m = metaWith('baize', 'zy', 0); // 白澤＝字音，unlockAt 0
  assert.equal(petPracticeBonus(m, 'zy-1'), 1);   // 同類、低階 +1
  assert.equal(petPracticeBonus(m, 'cy-1'), 0);   // 成語題不符 → 0
  const m2 = metaWith('baize', 'zy', 100);        // 100 精通＝Lv.5
  assert.equal(petPracticeBonus(m2, 'zy-1'), 2);  // 1 + min(2, floor(5/5)) = 2
});

test('混合寵物任何題固定 +1', () => {
  const m = metaWith('qiongqi', 'zy', 0); // 窮奇＝混合，unlockAt 0
  assert.equal(petPracticeBonus(m, 'zy-1'), 1);
  assert.equal(petPracticeBonus(m, 'cy-1'), 1);
  assert.equal(petPracticeBonus(m, 'mix-1'), 1);
});

test('petPracticeHint / activePetName 隨出戰寵物給說明', () => {
  assert.equal(petPracticeHint(defaultMeta()), null);
  const m = metaWith('baize', 'zy', 0);
  assert.equal(activePetName(m), '白澤');
  assert.match(petPracticeHint(m), /字音題答對 \+1珠/);
});

/* ===== 主動技能充能 usePetSkill ===== */
test('主動技能每日 MAX_PET_SKILL_USES 次、用完擋下', () => {
  const m = metaWith('baize', 'zy', 0);
  assert.equal(petSkillRemaining(m), MAX_PET_SKILL_USES);
  for (let i = 0; i < MAX_PET_SKILL_USES; i++) {
    assert.equal(usePetSkill(m).ok, true);
  }
  assert.equal(petSkillRemaining(m), 0);
  const over = usePetSkill(m);
  assert.equal(over.ok, false);
  assert.equal(over.reason, 'no-charge');
});

test('無出戰寵物不能用技能', () => {
  const m = defaultMeta();
  const r = usePetSkill(m);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'no-pet');
});
