// 作業式回合出題：整池每題各出一次（本輪不重複）；答錯的題整輪跑完後補一輪錯題複習；
// 全部答對後重洗整池、開新一輪。排序（哪一題先出）仍交給呼叫端的 pickFn（沿用 Leitner 盒位／難度）。
//
// rs 形狀：{ pool:string[]（本輪待出）, served:Set（本輪已出）, wrong:Set（本輪答錯待複習）, round:number }

export function createRoundState(ids) {
  return { pool: [...ids], served: new Set(), wrong: new Set(), round: 1 };
}

// 從本輪尚未出過的題中，交給 pickFn(candidates)→id 挑一題；本輪已出完回傳 null。
export function nextInRound(rs, pickFn) {
  const remaining = rs.pool.filter((id) => !rs.served.has(id));
  if (remaining.length === 0) return null;
  const id = pickFn(remaining);
  rs.served.add(id);
  return id;
}

// 記錄作答：答錯加入本輪錯題集；若（複習輪中）答對，從錯題集移除。
export function recordRound(rs, id, correct) {
  if (correct) rs.wrong.delete(id);
  else rs.wrong.add(id);
}

// 本輪出完後推進下一輪：
//  - 本輪有錯題 → 下一輪只複習這些錯題（mode:'wrong-review'）
//  - 本輪全對 → 重洗整池、開全新一輪（mode:'fresh'）
export function advanceRound(rs, allIds, shuffleFn) {
  rs.round += 1;
  rs.served = new Set();
  if (rs.wrong.size > 0) {
    rs.pool = [...rs.wrong];
    rs.wrong = new Set();
    return { mode: 'wrong-review', size: rs.pool.length, round: rs.round };
  }
  rs.pool = shuffleFn ? shuffleFn([...allIds]) : [...allIds];
  rs.wrong = new Set();
  return { mode: 'fresh', size: rs.pool.length, round: rs.round };
}
