// M1 開卷誓言：首次進站 3 張敘事卡＋4 句誓言擇一；每 30 天可換誓（重立道心）。

import { dayDiff } from './daily.js';
import { grantStreakCharm } from './charms.js';

export const RENEW_DAYS = 30;

export const INTRO_CARDS = [
  { id: 'intro-1', text: '上古《珠璣寶典》遭濁墨侵蝕，六百八十五顆字珠蒙塵散落墨界。' },
  { id: 'intro-2', text: '字音谷、字形林、珠璣海失了光彩，錯字妖橫行，村童唸不出字音。' },
  { id: 'intro-3', text: '寶典選中了你——受封「珠璣使者」的小書生。立下誓言，啟程拾珠。' },
];

export const OATHS = [
  { id: 'oath-1', text: '我願拾回每一顆失落的字珠' },
  { id: 'oath-2', text: '我要讓錯字再也騙不了我' },
  { id: 'oath-3', text: '我要練成看一眼就不會唸錯的眼力' },
  { id: 'oath-4', text: '我要成為守護珠璣寶典的書生' },
];

export function shouldShowIntro(meta) {
  return !meta.oath.storySeen;
}

export function markIntroSeen(meta) {
  meta.oath.storySeen = true;
  return meta;
}

// 自訂誓言：孩子可以自己寫一句（2–20 字），存在 meta.oath.customText。
export const CUSTOM_OATH_ID = 'oath-custom';
export const CUSTOM_OATH_MAX = 20;

export function swearOath(meta, oathId, today, customText = '') {
  let custom = null;
  if (oathId === CUSTOM_OATH_ID) {
    custom = String(customText).trim();
    if (custom.length < 2 || custom.length > CUSTOM_OATH_MAX) {
      return { meta, ok: false, reason: 'bad-custom-text' };
    }
  } else if (!OATHS.find(o => o.id === oathId)) {
    return { meta, ok: false, reason: 'unknown-oath' };
  }
  const o = meta.oath;
  const isRenewal = o.oathId !== null;
  if (isRenewal && o.swornAt && dayDiff(o.swornAt, today) < RENEW_DAYS) {
    return { meta, ok: false, reason: 'too-soon' };
  }
  o.oathId = oathId;
  if (custom !== null) o.customText = custom;
  o.swornAt = today;
  if (isRenewal) {
    o.renewCount += 1;
  } else {
    grantStreakCharm(meta); // 新手立誓當下直接送 1 枚起始護珠符，避免新手期完全無防護
  }
  return { meta, ok: true, renewed: isRenewal };
}

export function getOath(meta, today) {
  const o = meta.oath;
  if (!o.oathId) return null;
  const oath = OATHS.find(x => x.id === o.oathId);
  return {
    oathId: o.oathId,
    oathText: o.oathId === CUSTOM_OATH_ID ? (o.customText || '') : (oath ? oath.text : ''),
    swornAt: o.swornAt,
    canRenew: !!o.swornAt && dayDiff(o.swornAt, today) >= RENEW_DAYS,
  };
}
