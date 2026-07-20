import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHUYUAN_KEY, setStorageBackend, defaultShuyuan, loadShuyuan, saveShuyuan,
  getGateStage, getCourtyards, flourishTier, FLOURISH_TIERS, COURTYARDS,
  DECOR_KINDS, getDecorations, setDecorStyle, styleIndexOf,
  defaultPos, placeDecoration, resetPlacements,
  PLAQUE_TARGETS, PLAQUE_BANK, PLAQUE_MIN, PLAQUE_MAX,
  setPlaque, getPlaqueText, COUPLET_BANK, setCouplet, getCouplet,
} from '../js/meta/shuyuan-store.js';
import { defaultMeta } from '../js/meta/store.js';

function mockStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('defaultShuyuan 給出空佈局初始狀態', () => {
  const s = defaultShuyuan();
  assert.equal(s.v, 1);
  assert.equal(s.seeded, false);
  assert.deepEqual(s.placements, {});
  assert.deepEqual(s.styles, {});
  assert.deepEqual(s.plaques, {});
  assert.equal(s.couplet, null);
  assert.deepEqual(s.celebrated, []);
});

test('saveShuyuan 後 loadShuyuan 讀回相同狀態（key = zz_shuyuan）', () => {
  const backend = mockStorage();
  setStorageBackend(backend);
  const s = defaultShuyuan();
  s.placements['lantern-0'] = { x: 30, y: 60 };
  assert.equal(saveShuyuan(s), true);
  assert.notEqual(backend.getItem(SHUYUAN_KEY), null);
  const loaded = loadShuyuan();
  assert.deepEqual(loaded.placements, { 'lantern-0': { x: 30, y: 60 } });
  setStorageBackend(null);
});

test('loadShuyuan 遇壞資料退回預設，且補齊缺欄位', () => {
  const backend = mockStorage();
  setStorageBackend(backend);
  backend.setItem(SHUYUAN_KEY, '{"placements"');           // 壞 JSON
  assert.deepEqual(loadShuyuan(), defaultShuyuan());
  backend.setItem(SHUYUAN_KEY, '{"styles":{"path":1}}');   // 舊版缺欄位
  const s = loadShuyuan();
  assert.deepEqual(s.styles, { path: 1 });
  assert.deepEqual(s.celebrated, []);                       // 缺欄位補齊
  setStorageBackend(null);
});

test('getGateStage 直讀 meta.xp.rank，越界夾回 0–9', () => {
  const m = defaultMeta();
  assert.deepEqual(getGateStage(m), { stage: 0, rankName: '蒙童', total: 10 });
  m.xp.rank = 6;
  assert.equal(getGateStage(m).stage, 6);
  assert.equal(getGateStage(m).rankName, '貢士');
  m.xp.rank = 99;
  assert.equal(getGateStage(m).stage, 9);
});

test('flourishTier 門檻 0/10/30/60/100', () => {
  assert.equal(flourishTier(0), 0);
  assert.equal(flourishTier(9), 0);
  assert.equal(flourishTier(10), 1);
  assert.equal(flourishTier(30), 2);
  assert.equal(flourishTier(60), 3);
  assert.equal(flourishTier(100), 4);
  assert.equal(FLOURISH_TIERS.length, 5);
});

test('getCourtyards 直讀 world byZone 進度並算繁茂度', () => {
  const m = defaultMeta();
  m.world.byZone = { yin: 15, xing: 0, chengyu: 435 };
  const totals = { yin: 150, xing: 100, chengyu: 435 };
  const cs = getCourtyards(m, totals);
  assert.equal(cs.length, 3);
  assert.deepEqual(cs.map((c) => c.name), ['谷音亭', '墨林軒', '珠璣閣']);
  assert.equal(cs[0].pct, 10);
  assert.equal(cs[0].tierName, '初萌');
  assert.equal(cs[1].tierName, '荒蕪');
  assert.equal(cs[2].pct, 100);
  assert.equal(cs[2].tierName, '鼎盛');
  assert.equal(COURTYARDS[0].zoneName, '字音谷');
});

// 造一個有 earned 記錄的 meta：grade 品階、earnedAt 非空才算煉成
function metaWithPearls(counts) {
  const m = defaultMeta();
  let seq = 0;
  counts.forEach((n, grade) => {
    for (let i = 0; i < n; i++) {
      m.collection[`p${seq++}`] = { grade, wrong: 0, earnedAt: '2026-01-01', dusty: false, polish: 0, streak: 0 };
    }
  });
  return m;
}

test('DECOR_KINDS 四種裝飾、每種至少 3 個樣式', () => {
  assert.deepEqual(Object.keys(DECOR_KINDS), ['path', 'lantern', 'koi', 'statue']);
  for (const def of Object.values(DECOR_KINDS)) {
    assert.ok(def.styles.length >= 3, `${def.name} 樣式不足 3 種`);
  }
});

test('getDecorations 依品階數量換算件數並套上限', () => {
  // 白 25 → 2 段路；青 12 → 2 盞燈；金 7 → 2 盆；墨玉 3 → 3 尊
  const m = metaWithPearls([25, 12, 7, 3]);
  const ds = getDecorations(m, defaultShuyuan());
  const byKind = (k) => ds.filter((d) => d.kind === k);
  assert.equal(byKind('path').length, 2);
  assert.equal(byKind('lantern').length, 2);
  assert.equal(byKind('koi').length, 2);
  assert.equal(byKind('statue').length, 3);
  assert.equal(byKind('statue')[0].id, 'statue-0');
  // 上限：墨玉 99 顆也只出 12 尊
  const many = metaWithPearls([0, 0, 0, 99]);
  assert.equal(getDecorations(many, defaultShuyuan()).filter((d) => d.kind === 'statue').length, 12);
});

test('setDecorStyle 換樣式、無效值擋下', () => {
  const s = defaultShuyuan();
  assert.equal(setDecorStyle(s, 'lantern', 2).ok, true);
  assert.equal(styleIndexOf(s, 'lantern'), 2);
  assert.equal(setDecorStyle(s, 'lantern', 9).ok, false);
  assert.equal(setDecorStyle(s, 'nothing', 0).ok, false);
  // 換完樣式反映在 getDecorations
  const m = metaWithPearls([0, 5, 0, 0]);
  const d = getDecorations(m, s).find((x) => x.kind === 'lantern');
  assert.equal(d.styleIdx, 2);
  assert.equal(d.styleName, DECOR_KINDS.lantern.styles[2]);
});

test('defaultPos 確定性、不同 kind 分帶、座標在 2–98', () => {
  assert.deepEqual(defaultPos('lantern', 0), defaultPos('lantern', 0)); // 確定性
  assert.notDeepEqual(defaultPos('lantern', 0), defaultPos('lantern', 1)); // 同 kind 錯落
  for (const kind of Object.keys(DECOR_KINDS)) {
    for (let i = 0; i < DECOR_KINDS[kind].cap; i++) {
      const p = defaultPos(kind, i);
      assert.ok(p.x >= 2 && p.x <= 98 && p.y >= 2 && p.y <= 98, `${kind}-${i} 超界 ${JSON.stringify(p)}`);
    }
  }
});

test('placeDecoration 寫入座標並夾界；無效 id/座標擋下', () => {
  const s = defaultShuyuan();
  assert.equal(placeDecoration(s, 'statue-2', 120, -5).ok, true);
  assert.deepEqual(s.placements['statue-2'], { x: 98, y: 2 }); // 夾到 2–98
  assert.equal(placeDecoration(s, 'ghost-0', 10, 10).ok, false);
  assert.equal(placeDecoration(s, 'statue-1', NaN, 10).ok, false);
});

test('getDecorations 未擺放用 defaultPos、擺過用自訂座標、reset 後回預設', () => {
  const m = metaWithPearls([0, 0, 0, 2]); // 2 尊雕像
  const s = defaultShuyuan();
  let ds = getDecorations(m, s);
  assert.deepEqual({ x: ds[0].x, y: ds[0].y }, defaultPos('statue', 0));
  assert.equal(ds[0].custom, false);
  placeDecoration(s, 'statue-0', 33, 44);
  ds = getDecorations(m, s);
  assert.deepEqual({ x: ds[0].x, y: ds[0].y }, { x: 33, y: 44 });
  assert.equal(ds[0].custom, true);
  resetPlacements(s);
  ds = getDecorations(m, s);
  assert.equal(ds[0].custom, false);
});

// 匾額對聯詞庫命名
test('PLAQUE_BANK 至少 24 字且 id 不重複', () => {
  assert.ok(PLAQUE_BANK.length >= 24);
  assert.equal(new Set(PLAQUE_BANK.map((c) => c.id)).size, PLAQUE_BANK.length);
});

test('setPlaque 詞庫選字組匾額；越界長度/非法字/非法對象擋下', () => {
  const s = defaultShuyuan();
  const [a, b, c] = PLAQUE_BANK;
  assert.equal(setPlaque(s, 'gate', [a.id, b.id, c.id]).ok, true);
  assert.equal(getPlaqueText(s, 'gate'), `${a.ch}${b.ch}${c.ch}`);
  assert.equal(setPlaque(s, 'gate', [a.id]).ok, false);                       // 少於 2 字
  assert.equal(setPlaque(s, 'gate', [a.id, a.id, b.id, c.id, c.id]).ok, false); // 多於 4 字
  assert.equal(setPlaque(s, 'gate', [a.id, 'freetext']).ok, false);           // 不在詞庫
  assert.equal(setPlaque(s, 'roof', [a.id, b.id]).ok, false);                 // 非法對象
});

test('getPlaqueText 未題字回預設名', () => {
  const s = defaultShuyuan();
  assert.equal(getPlaqueText(s, 'gate'), '字靈書院');
  assert.equal(getPlaqueText(s, 'yin'), '谷音亭');
  assert.equal(getPlaqueText(s, 'xing'), '墨林軒');
  assert.equal(getPlaqueText(s, 'chengyu'), '珠璣閣');
});

test('setCouplet 掛對聯／取下；非法 id 擋下', () => {
  const s = defaultShuyuan();
  assert.equal(getCouplet(s), null);
  assert.equal(setCouplet(s, COUPLET_BANK[1].id).ok, true);
  assert.equal(getCouplet(s).up, COUPLET_BANK[1].up);
  assert.equal(setCouplet(s, 'nope').ok, false);
  assert.equal(setCouplet(s, null).ok, true);
  assert.equal(getCouplet(s), null);
});
