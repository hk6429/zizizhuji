// 衝分模式段位稱號：純標籤函式，依個人最佳分數對照，不涉及賽季/重置。
export const RUSH_TIERS = [
  { min: 0, name: '練字生' },
  { min: 200, name: '墨徒' },
  { min: 500, name: '文膽' },
  { min: 1000, name: '珠璣手' },
  { min: 2000, name: '墨界宗師' },
];

export function rushRankName(bestScore) {
  let name = RUSH_TIERS[0].name;
  for (const t of RUSH_TIERS) if (bestScore >= t.min) name = t.name;
  return name;
}
