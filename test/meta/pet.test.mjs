import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultMeta } from '../../js/meta/store.js';
import {
  PETS, PET_EQUIP, LEVEL_STEP, MAX_LEVEL, EQUIP_SLOTS, EQUIP_MAX_LEVEL, PET_BOND_MAX,
  categoryMastery, petLevel, isUnlocked, listPets, syncUnlocks,
  setActivePet, buyEquip, installEquip, uninstallEquip, getPetBattleMods, setPetNickname,
  addPetBond, getPetBondStage, upgradeEquip, getEquipLevel, setSubPet, clearSubPet, awardPetBadge,
} from '../../js/meta/pet.js';

// 造一個帶 N 顆已煉成字珠的 meta。prefix 'zy-'＝字音、'cy-'＝成語。
function metaWithForged(prefix, n) {
  const meta = defaultMeta();
  for (let i = 0; i < n; i++) {
    meta.collection[`${prefix}${i}`] = { grade: 0, wrong: 0, earnedAt: '2026-01-01T00:00:00Z', dusty: false, polish: 0, streak: 0 };
  }
  return meta;
}

test('PETS: 12 隻，字音／成語／混合各 4 隻', () => {
  assert.equal(PETS.length, 12);
  const byCat = { 字音: 0, 成語: 0, 混合: 0 };
  for (const p of PETS) byCat[p.category] += 1;
  assert.deepEqual(byCat, { 字音: 4, 成語: 4, 混合: 4 });
});

test('categoryMastery 依 id 前綴分類計精通題數', () => {
  const meta = metaWithForged('zy-', 5);
  meta.collection['cy-a'] = { earnedAt: 'x' };
  meta.collection['cy-b'] = { earnedAt: 'x' };
  meta.collection['zy-nope'] = { earnedAt: '' }; // 未煉成不算
  assert.equal(categoryMastery(meta, '字音'), 5);
  assert.equal(categoryMastery(meta, '成語'), 2);
  assert.equal(categoryMastery(meta, '混合'), 7);
});

test('petLevel = floor(精通數 / LEVEL_STEP)，封頂 MAX_LEVEL', () => {
  const baize = PETS.find((p) => p.id === 'baize'); // 字音
  assert.equal(petLevel(metaWithForged('zy-', 0), baize), 0);
  assert.equal(petLevel(metaWithForged('zy-', LEVEL_STEP), baize), 1);
  assert.equal(petLevel(metaWithForged('zy-', LEVEL_STEP * 3 + 5), baize), 3);
  assert.equal(petLevel(metaWithForged('zy-', LEVEL_STEP * 999), baize), MAX_LEVEL);
});

test('isUnlocked / syncUnlocks：達門檻才解鎖，事件只發一次', () => {
  const meta = metaWithForged('zy-', 12); // 字音精通 12
  assert.equal(isUnlocked(meta, 'baize'), true);  // unlockAt 0
  assert.equal(isUnlocked(meta, 'kui'), true);    // unlockAt 10
  assert.equal(isUnlocked(meta, 'bifang'), false); // unlockAt 30
  const first = syncUnlocks(meta).events.map((e) => e.payload.id);
  assert.ok(first.includes('baize') && first.includes('kui'));
  // 其他類別 unlockAt 0 的也一併解鎖（混合精通含全部＝12）
  const second = syncUnlocks(meta).events;
  assert.equal(second.length, 0, '第二次不應再發已解鎖的事件');
});

test('setActivePet：鎖住的不能出戰', () => {
  const meta = metaWithForged('zy-', 0);
  assert.equal(setActivePet(meta, 'bifang').ok, false); // 未解鎖
  assert.equal(setActivePet(meta, 'baize').ok, true);
  assert.equal(meta.pet.active, 'baize');
  assert.equal(setActivePet(meta, 'ghost').ok, false); // 不存在
});

test('設備：字珠不足不能買、買了才能裝、欄位滿擋下', () => {
  const meta = metaWithForged('zy-', 0);
  meta.pearls.balance = 500;
  const cheap = PET_EQUIP[0].id, mid = PET_EQUIP[1].id, third = PET_EQUIP[2].id;
  assert.equal(buyEquip(meta, cheap).ok, true);
  assert.equal(meta.pearls.balance, 500 - PET_EQUIP[0].price);
  assert.equal(buyEquip(meta, cheap).ok, false); // 重複買
  assert.equal(installEquip(meta, 'baize', mid).ok, false); // 沒買不能裝
  buyEquip(meta, mid); buyEquip(meta, third);
  assert.equal(installEquip(meta, 'baize', cheap).ok, true);
  assert.equal(installEquip(meta, 'baize', mid).ok, true);
  assert.equal(installEquip(meta, 'baize', third).ok, false); // 兩格已滿
  assert.equal(EQUIP_SLOTS, 2);
});

test('買不起時回 pearls 且不扣款', () => {
  const meta = metaWithForged('zy-', 0);
  meta.pearls.balance = 10;
  const r = buyEquip(meta, PET_EQUIP[3].id);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'pearls');
  assert.equal(meta.pearls.balance, 10);
});

test('getPetBattleMods：主寵等級 + 設備效果，且鎖住/未出戰回 0', () => {
  const meta = metaWithForged('zy-', LEVEL_STEP * 3); // 白澤 3 級
  assert.deepEqual(getPetBattleMods(meta), { damageBonus: 0, freeEliminate: 0 }, '未選主寵回 0');
  setActivePet(meta, 'baize');
  assert.deepEqual(getPetBattleMods(meta), { damageBonus: 3, freeEliminate: 0 });
  meta.pearls.balance = 500;
  buyEquip(meta, 'xirang'); // damageBonus +2
  buyEquip(meta, 'ling');   // freeEliminate +1
  installEquip(meta, 'baize', 'xirang');
  installEquip(meta, 'baize', 'ling');
  assert.deepEqual(getPetBattleMods(meta), { damageBonus: 5, freeEliminate: 1 });
});

test('listPets 回傳解鎖/等級/下一級門檻', () => {
  const meta = metaWithForged('zy-', LEVEL_STEP + 3);
  const baize = listPets(meta).find((p) => p.id === 'baize');
  assert.equal(baize.unlocked, true);
  assert.equal(baize.level, 1);
  assert.equal(baize.nextAt, LEVEL_STEP * 2);
  const kun = listPets(meta).find((p) => p.id === 'kun'); // 混合 unlockAt 90
  assert.equal(kun.unlocked, false);
});

test('uninstallEquip 卸下後欄位空出', () => {
  const meta = metaWithForged('zy-', 0);
  meta.pearls.balance = 500;
  buyEquip(meta, 'wo');
  installEquip(meta, 'baize', 'wo');
  assert.equal(uninstallEquip(meta, 'baize', 'wo').ok, true);
  assert.equal(installEquip(meta, 'baize', 'wo').ok, true); // 又能裝回
});

test('defaultMeta 內含 pet 初始狀態', () => {
  assert.deepEqual(defaultMeta().pet, {
    seen: {}, active: null, ownedEquip: [], equipped: {}, nicknames: {},
    bond: {}, unlockedAt: {}, badges: {}, equipLevel: {}, subActive: null,
  });
});

test('弱點加權：曾答錯過（wrong>0）才煉成的題，精通貢獻 1.5 倍', () => {
  const meta = defaultMeta();
  for (let i = 0; i < 10; i++) {
    meta.collection[`zy-clean${i}`] = { grade: 0, wrong: 0, earnedAt: '2026-01-01', dusty: false, polish: 0, streak: 0 };
  }
  for (let i = 0; i < 10; i++) {
    meta.collection[`zy-weak${i}`] = { grade: 0, wrong: 1, earnedAt: '2026-01-01', dusty: false, polish: 0, streak: 0 };
  }
  // 10 題乾淨(×1) + 10 題曾答錯(×1.5) = 25
  assert.equal(categoryMastery(meta, '字音'), 25);
  const baize = PETS.find((p) => p.id === 'baize');
  assert.equal(petLevel(meta, baize), 1); // floor(25/20) = 1，比純 20 題（0 級）提早升級
});

test('addPetBond / getPetBondStage：三階段跨階、封頂 100', () => {
  const meta = metaWithForged('zy-', 0);
  assert.equal(getPetBondStage(meta, 'baize').stage, 0);
  let r = addPetBond(meta, 'baize', 30);
  assert.equal(r.stageUp, false);
  assert.equal(getPetBondStage(meta, 'baize').value, 30);
  r = addPetBond(meta, 'baize', 10); // 30+10=40 ≥ 34，跨到「漸熟」
  assert.equal(r.stageUp, true);
  assert.equal(getPetBondStage(meta, 'baize').name, '漸熟');
  addPetBond(meta, 'baize', 30); // 40+30=70 ≥ 67，跨到「知己」
  assert.equal(getPetBondStage(meta, 'baize').name, '知己');
  addPetBond(meta, 'baize', 9999);
  assert.equal(getPetBondStage(meta, 'baize').value, PET_BOND_MAX);
});

test('upgradeEquip：字珠不足擋下、精通門檻未達擋下、成功升級後戰鬥加成按等級倍率增加、滿級不可再升', () => {
  const meta = metaWithForged('zy-', 0);
  meta.pearls.balance = 1000;
  setActivePet(meta, 'baize');
  buyEquip(meta, 'wo'); // damageBonus 1, upgradeGate [10,30], upgradeCost [80,160]
  installEquip(meta, 'baize', 'wo');
  assert.equal(getEquipLevel(meta, 'wo'), 1);
  assert.deepEqual(getPetBattleMods(meta), { damageBonus: 1, freeEliminate: 0 }); // lv1 ×1

  assert.equal(upgradeEquip(meta, 'wo').reason, 'gate'); // 精通 0 < 10
  meta.collection['zy-a'] = { grade: 0, wrong: 0, earnedAt: '2026-01-01', dusty: false, polish: 0, streak: 0 };
  for (let i = 0; i < 10; i++) meta.collection[`zy-b${i}`] = { grade: 0, wrong: 0, earnedAt: '2026-01-01', dusty: false, polish: 0, streak: 0 };
  assert.equal(upgradeEquip(meta, 'wo').ok, true); // 精通 11 ≥ 10，升到 Lv.2
  assert.equal(getEquipLevel(meta, 'wo'), 2);
  assert.deepEqual(getPetBattleMods(meta), { damageBonus: 2, freeEliminate: 0 }); // 1*1.5 round = 2

  meta.pearls.balance = 0;
  assert.equal(upgradeEquip(meta, 'wo').reason, 'gate'); // 精通仍 <30，門檻先擋（不論字珠）
  for (let i = 0; i < 20; i++) meta.collection[`zy-c${i}`] = { grade: 0, wrong: 0, earnedAt: '2026-01-01', dusty: false, polish: 0, streak: 0 };
  assert.equal(upgradeEquip(meta, 'wo').reason, 'pearls'); // 精通已達 30+，換成字珠不足
  meta.pearls.balance = 1000;
  assert.equal(upgradeEquip(meta, 'wo').ok, true); // 升到 Lv.3
  assert.equal(getEquipLevel(meta, 'wo'), EQUIP_MAX_LEVEL);
  assert.equal(upgradeEquip(meta, 'wo').reason, 'max-level');
});

test('setSubPet / clearSubPet：不可與主寵相同，getPetBattleMods 副寵加成封頂 +3', () => {
  const meta = metaWithForged('zy-', LEVEL_STEP * 3); // 白澤 3 級
  meta.collection['cy-a'] = { grade: 0, wrong: 0, earnedAt: '2026-01-01', dusty: false, polish: 0, streak: 0 }; // 鳳凰(成語) 解鎖
  setActivePet(meta, 'baize');
  assert.equal(setSubPet(meta, 'baize').ok, false); // 不可與主寵相同
  assert.equal(setSubPet(meta, 'fenghuang').ok, true);
  assert.deepEqual(getPetBattleMods(meta), { damageBonus: 3, freeEliminate: 0 }); // 副寵 0 級 → +0
  assert.equal(setActivePet(meta, 'fenghuang').ok, true); // 把副寵直接扶正為主寵，應自動清空 subActive
  assert.equal(meta.pet.subActive, null);
  clearSubPet(meta); // no-op，確認可安全重複呼叫
  assert.equal(meta.pet.subActive, null);
});

test('syncUnlocks 寫入 unlockedAt：解鎖當下有值、之後不重複覆寫', () => {
  const meta = metaWithForged('zy-', 0);
  const before = syncUnlocks(meta);
  assert.ok(before.meta.pet.unlockedAt.baize);
  const stamp = meta.pet.unlockedAt.baize;
  syncUnlocks(meta); // 再掃一次不應覆寫
  assert.equal(meta.pet.unlockedAt.baize, stamp);
});

test('awardPetBadge：里程碑 tier 觸發時 active pet 拿到徽章、無 active pet 時 no-op、重複 tier 不重複 push', () => {
  const meta = metaWithForged('zy-', 0);
  assert.equal(awardPetBadge(meta, 1).awarded, false); // 無 active pet
  setActivePet(meta, 'baize');
  assert.equal(awardPetBadge(meta, 1).awarded, true);
  assert.deepEqual(meta.pet.badges.baize, [1]);
  assert.equal(awardPetBadge(meta, 1).awarded, false); // 重複 tier
  assert.equal(awardPetBadge(meta, 2).awarded, true);
  assert.deepEqual(meta.pet.badges.baize, [1, 2]);
});

test('setPetNickname：1–8 字入檔、太長拒收、空字串清除、鎖住的不能取名', () => {
  const meta = metaWithForged('zy-', 0);
  assert.equal(setPetNickname(meta, 'baize', '小白白').ok, true);
  assert.equal(listPets(meta).find((p) => p.id === 'baize').displayName, '小白白');
  assert.equal(setPetNickname(meta, 'baize', '九個字九個字九個字').ok, false); // >8 字
  assert.equal(setPetNickname(meta, 'baize', '  ').ok, true); // 空白＝清除
  assert.equal(listPets(meta).find((p) => p.id === 'baize').displayName, '白澤');
  assert.equal(setPetNickname(meta, 'kun', '小鯤').ok, false); // 未解鎖
});
