// M5 文房四寶：12 件法寶（筆墨紙硯 ×3 檔價 80/150/300），戰前選 2 件組 loadout。
// getModifiers 產出 BattleMods 純資料物件，由 battle-adapter 疊進戰鬥；battle.js 零改動。

import { spendPearls } from './economy.js';

export const LOADOUT_SIZE = 2;

export const GEAR_LIST = [
  { id: 'langhao', name: '狼毫筆', category: '筆', price: 80, desc: '連對門檻 3→2', effect: { key: 'comboThreshold', value: 2 } },
  { id: 'zihao', name: '紫毫筆', category: '筆', price: 150, desc: '連對加成傷害 15→20', effect: { key: 'comboBonusDamage', value: 20 } },
  { id: 'huying', name: '湖穎筆', category: '筆', price: 300, desc: '字音題傷害 +2', effect: { key: 'typeBonus', type: '字音', value: 2 } },
  { id: 'songyan', name: '松煙墨', category: '墨', price: 150, desc: '每場首次答錯不斷連對', effect: { key: 'firstMissKeepsCombo', value: true } },
  { id: 'youyan', name: '油煙墨', category: '墨', price: 80, desc: '答錯時對手也扣 3', effect: { key: 'missReflect', value: 3 } },
  { id: 'huimo', name: '徽墨', category: '墨', price: 300, desc: '成語題傷害 +2', effect: { key: 'typeBonus', type: '成語', value: 2 } },
  { id: 'chengxin', name: '澄心紙', category: '紙', price: 80, desc: '我方 HP 100→120', effect: { key: 'maxHp', value: 120 } },
  { id: 'yuban', name: '玉版紙', category: '紙', price: 150, desc: '第 10 題起傷害 +3', effect: { key: 'lateBonus', value: 3 } },
  { id: 'xuanzhi', name: '宣紙', category: '紙', price: 300, desc: '字形題傷害 +2', effect: { key: 'typeBonus', type: '字形', value: 2 } },
  { id: 'duanyan', name: '端硯', category: '硯', price: 150, desc: '答對回血 4', effect: { key: 'healOnCorrect', value: 4 } },
  { id: 'sheyan', name: '歙硯', category: '硯', price: 300, desc: '連對達 5 一次爆發 30 傷（每場一次）', effect: { key: 'burst30At5', value: true } },
  { id: 'taoyan', name: '洮硯', category: '硯', price: 80, desc: '墨氣獲取 +1', effect: { key: 'inkBonus', value: 1 } },
];

export function buyGear(meta, gearId) {
  const gear = GEAR_LIST.find(g => g.id === gearId);
  if (!gear) return { meta, ok: false, reason: 'not-found' };
  if (meta.gear.owned.includes(gearId)) return { meta, ok: false, reason: 'owned' };
  const paid = spendPearls(meta, gear.price, `gear:${gearId}`);
  if (!paid.ok) return { meta, ok: false, reason: 'pearls' };
  meta.gear.owned.push(gearId);
  return { meta, ok: true, reason: null };
}

export function setLoadout(meta, gearIds) {
  if (!Array.isArray(gearIds) || gearIds.length > LOADOUT_SIZE) return { meta, ok: false };
  if (new Set(gearIds).size !== gearIds.length) return { meta, ok: false };
  if (!gearIds.every(id => meta.gear.owned.includes(id))) return { meta, ok: false };
  meta.gear.loadout = [...gearIds];
  return { meta, ok: true };
}

export function baseModifiers() {
  return {
    comboThreshold: 3,
    comboBonusDamage: 15,
    typeBonus: { '字音': 0, '字形': 0, '成語': 0 },
    firstMissKeepsCombo: false,
    missReflect: 0,
    maxHp: 100,
    lateBonus: 0,
    lateFrom: 10,
    healOnCorrect: 0,
    burst30At5: false,
    inkBonus: 0,
  };
}

export function getModifiers(meta) {
  const mods = baseModifiers();
  for (const id of meta.gear.loadout) {
    const gear = GEAR_LIST.find(g => g.id === id);
    if (!gear) continue;
    const eff = gear.effect;
    if (eff.key === 'typeBonus') mods.typeBonus[eff.type] += eff.value;
    else mods[eff.key] = eff.value;
  }
  return mods;
}
