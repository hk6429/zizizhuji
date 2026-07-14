// M3 集珠圖鑑：Leitner 盒位持久化（不動 leitner.js）＋煉成/品階（白青金墨玉）＋蒙塵/擦亮。
// 煉成＝某題升滿第 5 盒；品階依煉成過程錯誤數定級；煉成後連對 3 次升一階。
// 蒙塵＝已煉成的珠答錯：不收回、降到第 3 盒；再連續答對 2 次擦亮（回第 5 盒＋2 珠，由 kernel 發珠）。

export const GRADES = ['白珠', '青珠', '金珠', '墨玉'];
export const MAX_BOX = 5;
const DUSTY_BOX = 3;
const POLISH_NEED = 2;
const GRADE_UP_STREAK = 3;

function record(meta, id) {
  if (!meta.collection[id]) {
    meta.collection[id] = { grade: -1, wrong: 0, earnedAt: '', dusty: false, polish: 0, streak: 0 };
  }
  return meta.collection[id];
}

// 把 zzj_meta.leitner（{id: box}）還原成 leitner.js 用的 Map；未見過的題回到第 1 盒。
export function loadLeitnerState(meta, ids) {
  return new Map(ids.map(id => [id, meta.leitner[id] ?? 1]));
}

export function persistLeitner(meta, leitnerMap) {
  meta.leitner = Object.fromEntries(leitnerMap);
  return meta;
}

// 每題結算後呼叫；newBox = leitner.recordAnswer 後的盒位。
// 回傳 events：pearlForged / pearlDusted / pearlPolished / gradeUp。
// 事件 payload 含 setBox 時，呼叫端需把活的 leitner Map 同步到該盒位。
export function onQuestionResult(meta, id, correct, newBox) {
  const events = [];
  const r = record(meta, id);

  if (!r.earnedAt) {
    // 尚未煉成：累計錯誤數，升滿第 5 盒即煉成
    if (!correct) {
      r.wrong += 1;
    } else if (newBox >= MAX_BOX) {
      r.earnedAt = new Date().toISOString();
      r.grade = r.wrong === 0 ? 2 : r.wrong === 1 ? 1 : 0; // 金/青/白
      r.streak = 0;
      events.push({
        type: 'pearlForged',
        payload: { id, grade: r.grade, gradeName: GRADES[r.grade] },
        fx: r.grade === 2 ? 'pearl-glow-gold' : r.grade === 1 ? 'pearl-glow-cyan' : 'pearl-glow-white',
      });
    }
    return { meta, events };
  }

  if (r.dusty) {
    if (correct) {
      r.polish += 1;
      if (r.polish >= POLISH_NEED) {
        r.dusty = false;
        r.polish = 0;
        meta.leitner[id] = MAX_BOX;
        events.push({
          type: 'pearlPolished',
          payload: { id, grade: r.grade, gradeName: GRADES[r.grade], setBox: MAX_BOX },
          fx: 'pearl-polish',
        });
      }
    } else {
      r.polish = 0; // 擦亮要「連續」答對
      meta.leitner[id] = DUSTY_BOX;
    }
    return { meta, events };
  }

  if (!correct) {
    // 蒙塵：不收回、不降回第 1 盒
    r.dusty = true;
    r.polish = 0;
    r.streak = 0;
    meta.leitner[id] = DUSTY_BOX;
    events.push({
      type: 'pearlDusted',
      payload: { id, setBox: DUSTY_BOX, message: '字珠蒙塵了，再答對 2 次就能擦亮' },
      fx: 'pearl-dust',
    });
    return { meta, events };
  }

  // 已煉成且乾淨：連對 3 次升一階（頂級墨玉）
  r.streak += 1;
  if (r.streak >= GRADE_UP_STREAK && r.grade < GRADES.length - 1) {
    r.grade += 1;
    r.streak = 0;
    events.push({
      type: 'gradeUp',
      payload: { id, grade: r.grade, gradeName: GRADES[r.grade] },
      fx: r.grade === 3 ? 'pearl-glow-obsidian' : 'pearl-grade-up',
    });
  }
  return { meta, events };
}

export function getCollection(meta) {
  const earned = [];
  const counts = GRADES.map(() => 0);
  let dustyCount = 0;
  for (const [id, r] of Object.entries(meta.collection)) {
    if (!r.earnedAt) continue;
    earned.push({ id, grade: r.grade, gradeName: GRADES[r.grade], dusty: r.dusty, earnedAt: r.earnedAt });
    counts[r.grade] += 1;
    if (r.dusty) dustyCount += 1;
  }
  return { earned, counts, dustyCount };
}

export function getPolishTasks(meta) {
  const tasks = [];
  for (const [id, r] of Object.entries(meta.collection)) {
    if (r.earnedAt && r.dusty) tasks.push({ id, remaining: POLISH_NEED - r.polish });
  }
  return tasks;
}
